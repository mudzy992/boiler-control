import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../components/Input';
import { Select } from '@/ui';
import { InputNumber } from '../../../components/InputNumber';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { apiClient } from '../../../services/api';
import { PageHeader } from '@/shared/components/page-header';
import { QueryState } from '@/shared/components/query-state';
import { StatusBanner } from '@/shared/components/status-banner';
import type { CreateHomeProfileDto, HomeProfileResponse } from '../types';
import {
  catalogGroups,
  isKnownFamilyId,
  selectionHint,
  type BoilerCatalog,
} from '../lib/boiler-catalog';
import {
  INSULATION_TYPE_OPTIONS,
  WINDOW_TYPE_OPTIONS,
  HEATING_TYPE_OPTIONS,
  InsulationType,
  WindowType,
  HeatingType,
} from '../../../constants/homeProfileEnums';

interface HomeProfileFormValues {
  homeName: string;
  floorArea: number | undefined;
  ceilingHeight: number | undefined;
  insulationType: InsulationType;
  insulationThickness: number | undefined;
  windowType: WindowType;
  heatingType: HeatingType;
  constructionYear: number | undefined;
  numberOfResidents: number | undefined;
  /** Zastarjelo, samo za prikaz ranije unesenog teksta (`19` §1). */
  boilerModel: string;
  /** Odabir iz kataloga — ovo nosi sigurnosni bit. */
  boilerCatalogId: string;
  hasFloorHeating: boolean;
  targetMorningTemp: number | undefined;
  targetDayTemp: number | undefined;
  targetNightTemp: number | undefined;
  preferredScheduleNotes: string;
}

const EMPTY_VALUES: HomeProfileFormValues = {
  homeName: '',
  floorArea: undefined,
  ceilingHeight: undefined,
  insulationType: InsulationType.STANDARD,
  insulationThickness: undefined,
  windowType: WindowType.DOUBLE_GLAZED,
  heatingType: HeatingType.RADIATOR,
  constructionYear: undefined,
  numberOfResidents: undefined,
  boilerModel: '',
  boilerCatalogId: '',
  hasFloorHeating: false,
  targetMorningTemp: undefined,
  targetDayTemp: undefined,
  targetNightTemp: undefined,
  preferredScheduleNotes: '',
};

export const HomeProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<HomeProfileResponse | null>(null);
  const [form, setForm] = useState<HomeProfileFormValues>(EMPTY_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [catalog, setCatalog] = useState<BoilerCatalog | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Katalog i profil nezavisno: bez kataloga forma radi, samo nema
        // izbora modela — a to je bolje nego da cijela stranica padne.
        apiClient
          .getBoilerCatalog()
          .then(setCatalog)
          .catch((error) => console.error('Failed to load boiler catalog:', error));

        const response = await apiClient.getHomeProfile();
        if (response) {
          const loaded = response as HomeProfileResponse;
          setProfile(loaded);
          setForm({
            homeName: loaded.homeName ?? '',
            floorArea: loaded.floorArea,
            ceilingHeight: loaded.ceilingHeight,
            insulationType: loaded.insulationType ?? InsulationType.STANDARD,
            insulationThickness: loaded.insulationThickness,
            windowType: loaded.windowType ?? WindowType.DOUBLE_GLAZED,
            heatingType: loaded.heatingType ?? HeatingType.RADIATOR,
            constructionYear: loaded.constructionYear,
            numberOfResidents: loaded.numberOfResidents,
            boilerModel: loaded.boilerModel ?? '',
            boilerCatalogId: loaded.boilerCatalogId ?? '',
            hasFloorHeating: loaded.hasFloorHeating ?? false,
            targetMorningTemp: loaded.targetMorningTemp,
            targetDayTemp: loaded.targetDayTemp,
            targetNightTemp: loaded.targetNightTemp,
            preferredScheduleNotes: loaded.preferredScheduleNotes ?? '',
          });
        }
      } catch (error) {
        console.error('Failed to load home profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChange = useCallback(
    (
      field: keyof HomeProfileFormValues,
      value: string | number | boolean | undefined,
    ) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: '' }));
      setSaveStatus('idle');
    },
    [],
  );

  const validate = useCallback(() => {
    const next: Record<string, string> = {};
    const required: Record<string, string> = {
      homeName: t('homeProfile.homeName'),
      floorArea: t('homeProfile.floorArea'),
      ceilingHeight: t('homeProfile.ceilingHeight'),
      constructionYear: t('homeProfile.constructionYear'),
      insulationType: t('homeProfile.insulationType'),
      windowType: t('homeProfile.windowType'),
      heatingType: t('homeProfile.heatingType'),
    };

    Object.entries(required).forEach(([field, label]) => {
      const value = form[field as keyof HomeProfileFormValues];
      if (value === '' || value === undefined || value === null) {
        next[field] = `${label} je obavezno`;
      }
    });

    const ranges: Array<[string, number, number]> = [
      ['floorArea', 10, 2000],
      ['ceilingHeight', 2, 5],
      ['constructionYear', 1800, 2100],
      ['insulationThickness', 0, 50],
      ['numberOfResidents', 1, 20],
      ['targetMorningTemp', 5, 30],
      ['targetDayTemp', 5, 30],
      ['targetNightTemp', 5, 30],
    ];
    ranges.forEach(([field, min, max]) => {
      const value = form[field as keyof HomeProfileFormValues] as
        | number
        | undefined;
      if (value !== undefined && (value < min || value > max)) {
        next[field] = t('homeProfile.outOfRange', { min, max });
      }
    });

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, t]);

  const onSubmit = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const payload = {
        ...form,
        insulationType: form.insulationType,
        windowType: form.windowType,
        heatingType: form.heatingType,
        // Prazan izbor se šalje kao `null` (briše model), ne kao `''` — `''`
        // bi backend odbio kao nepoznat zapis.
        boilerCatalogId: form.boilerCatalogId === '' ? null : form.boilerCatalogId,
      };
      if (profile?.id) {
        await apiClient.updateHomeProfile(profile.id, payload);
      } else {
        await apiClient.createHomeProfile(payload as CreateHomeProfileDto);
      }
      setSaveStatus('ok');
    } catch (error) {
      console.error('Failed to save home profile:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [form, profile, validate]);

  const catalogGroupsMemo = useMemo(() => catalogGroups(catalog), [catalog]);

  /**
   * Zapis koji je u profilu, a nema ga u katalogu (npr. katalog je izmijenjen
   * ili je model povučen). Ne brišemo ga sami — prikazujemo ga, da korisnik
   * vidi šta je sačuvano i svjesno odabere novo.
   */
  const staleFamilyId =
    form.boilerCatalogId &&
    !isKnownFamilyId(catalog?.families, form.boilerCatalogId)
      ? form.boilerCatalogId
      : null;

  const isDirty = useMemo(() => {
    if (!profile) return false;
    return (
      form.homeName !== profile.homeName ||
      form.floorArea !== profile.floorArea ||
      form.ceilingHeight !== profile.ceilingHeight ||
      form.insulationType !== profile.insulationType ||
      form.insulationThickness !== profile.insulationThickness ||
      form.windowType !== profile.windowType ||
      form.heatingType !== profile.heatingType ||
      form.constructionYear !== profile.constructionYear ||
      form.numberOfResidents !== profile.numberOfResidents ||
      form.boilerCatalogId !== (profile.boilerCatalogId ?? '') ||
      form.hasFloorHeating !== profile.hasFloorHeating ||
      form.targetMorningTemp !== profile.targetMorningTemp ||
      form.targetDayTemp !== profile.targetDayTemp ||
      form.targetNightTemp !== profile.targetNightTemp ||
      form.preferredScheduleNotes !== profile.preferredScheduleNotes
    );
  }, [form, profile]);

  if (loading) {
    return <QueryState status="loading" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('homeProfile.title')} description={t('homeProfile.subtitle')} />

      {saveStatus === 'ok' ? (
        <StatusBanner variant="success" message={t('homeProfile.saveSuccess')} />
      ) : null}
      {saveStatus === 'error' ? (
        <StatusBanner variant="error" message={t('homeProfile.saveError')} />
      ) : null}

      <Card variant="elevated">
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 sm:pt-5 lg:grid-cols-3">
          <Input
            label={t('homeProfile.homeName')}
            placeholder="My Home"
            id="home-profile-home-name"
            value={form.homeName}
            error={errors.homeName}
            onChange={(e) => handleChange('homeName', e.target.value)}
            disabled={saving}
          />
          <InputNumber
            label={t('homeProfile.floorArea')}
            placeholder="100"
            id="home-profile-floor-area"
            value={form.floorArea}
            min={10}
            max={2000}
            error={errors.floorArea}
            onChange={(value) =>
              handleChange(
                'floorArea',
                typeof value === 'number' ? value : undefined,
              )
            }
            disabled={saving}
          />
          <InputNumber
            label={t('homeProfile.ceilingHeight')}
            placeholder="2.6"
            id="home-profile-ceiling-height"
            value={form.ceilingHeight}
            min={2}
            max={5}
            step={0.1}
            precision={1}
            error={errors.ceilingHeight}
            onChange={(value) =>
              handleChange(
                'ceilingHeight',
                typeof value === 'number' ? value : undefined,
              )
            }
            disabled={saving}
          />
            <InputNumber
              label={t('homeProfile.constructionYear')}
              placeholder={String(new Date().getFullYear())}
            id="home-profile-construction-year"
            value={form.constructionYear}
            min={1800}
            max={2100}
            error={errors.constructionYear}
            onChange={(value) =>
              handleChange(
                'constructionYear',
                typeof value === 'number' ? value : undefined,
              )
            }
            disabled={saving}
          />
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-semibold text-text-secondary mb-1">
              {t('homeProfile.insulationType')}
            </label>
            <select
              id="home-profile-insulation-type"
              value={form.insulationType}
              onChange={(e) =>
                handleChange('insulationType', e.target.value as InsulationType)
              }
              disabled={saving}
              className="block w-full rounded-lg border border-border px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand bg-surface text-text-primary"
            >
              {INSULATION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.insulationType && (
              <p className="mt-1 text-sm text-error">
                {errors.insulationType}
              </p>
            )}
          </div>
          <InputNumber
            label={t('homeProfile.insulationThickness')}
            placeholder="10"
            id="home-profile-insulation-thickness"
            value={form.insulationThickness}
            min={0}
            max={50}
            error={errors.insulationThickness}
            onChange={(value) =>
              handleChange(
                'insulationThickness',
                typeof value === 'number' ? value : undefined,
              )
            }
            disabled={saving}
          />
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-semibold text-text-secondary mb-1">
              {t('homeProfile.windowType')}
            </label>
            <select
              id="home-profile-window-type"
              value={form.windowType}
              onChange={(e) =>
                handleChange('windowType', e.target.value as WindowType)
              }
              disabled={saving}
              className="block w-full rounded-lg border border-border px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand bg-surface text-text-primary"
            >
              {WINDOW_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.windowType && (
              <p className="mt-1 text-sm text-error">
                {errors.windowType}
              </p>
            )}
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-semibold text-text-secondary mb-1">
              {t('homeProfile.heatingType')}
            </label>
            <select
              id="home-profile-heating-type"
              value={form.heatingType}
              onChange={(e) =>
                handleChange('heatingType', e.target.value as HeatingType)
              }
              disabled={saving}
              className="block w-full rounded-lg border border-border px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand bg-surface text-text-primary"
            >
              {HEATING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.heatingType && (
              <p className="mt-1 text-sm text-error">
                {errors.heatingType}
              </p>
            )}
          </div>
          <InputNumber
            label={t('homeProfile.numberOfResidents')}
            placeholder="1"
            id="home-profile-number-of-residents"
            value={form.numberOfResidents}
            min={1}
            max={20}
            error={errors.numberOfResidents}
            onChange={(value) =>
              handleChange(
                'numberOfResidents',
                typeof value === 'number' ? value : undefined,
              )
            }
            disabled={saving}
          />
          <div className="space-y-1">
            <label
              htmlFor="home-profile-boiler-catalog"
              className="text-sm font-medium text-text-secondary"
            >
              {t('homeProfile.boilerModel')}
            </label>
            <Select
              id="home-profile-boiler-catalog"
              value={form.boilerCatalogId}
              invalid={Boolean(errors.boilerCatalogId)}
              onChange={(e) => handleChange('boilerCatalogId', e.target.value)}
              disabled={saving || catalogGroupsMemo.length === 0}
            >
              <option value="">{t('homeProfile.boilerModelNone')}</option>
              {staleFamilyId ? (
                <option value={staleFamilyId}>
                  {t('homeProfile.boilerModelStale', { id: staleFamilyId })}
                </option>
              ) : null}
              {catalogGroupsMemo.map((group) => (
                <optgroup key={group.brand} label={group.brand}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <p className="text-xs text-text-secondary" data-testid="boiler-hint">
              {selectionHint(catalog?.families, form.boilerCatalogId)}
            </p>
            {!form.boilerCatalogId && form.boilerModel ? (
              <p className="text-xs text-text-secondary">
                {t('homeProfile.boilerModelLegacy', { model: form.boilerModel })}
              </p>
            ) : null}
          </div>
          <div className="col-span-2 md:col-span-1 flex items-end">
            <label className="mr-2 text-sm font-semibold text-text-secondary">
              {t('homeProfile.hasFloorHeating')}
            </label>
            <input
              type="checkbox"
              id="home-profile-has-floor-heating"
              checked={form.hasFloorHeating}
              onChange={(e) => handleChange('hasFloorHeating', e.target.checked)}
              disabled={saving}
              className="rounded border-border text-brand focus:ring-brand"
            />
          </div>
          <InputNumber
            label={t('homeProfile.targetMorningTemp')}
            placeholder="22"
            id="home-profile-target-morning-temp"
            value={form.targetMorningTemp}
            min={5}
            max={30}
            error={errors.targetMorningTemp}
            onChange={(value) =>
              handleChange(
                'targetMorningTemp',
                typeof value === 'number' ? value : undefined,
              )
            }
            disabled={saving}
          />
          <InputNumber
            label={t('homeProfile.targetDayTemp')}
            placeholder="20"
            id="home-profile-target-day-temp"
            value={form.targetDayTemp}
            min={5}
            max={30}
            error={errors.targetDayTemp}
            onChange={(value) =>
              handleChange('targetDayTemp', typeof value === 'number' ? value : undefined)
            }
            disabled={saving}
          />
          <InputNumber
            label={t('homeProfile.targetNightTemp')}
            placeholder="18"
            id="home-profile-target-night-temp"
            value={form.targetNightTemp}
            min={5}
            max={30}
            error={errors.targetNightTemp}
            onChange={(value) =>
              handleChange(
                'targetNightTemp',
                typeof value === 'number' ? value : undefined,
              )
            }
            disabled={saving}
          />
          <div className="col-span-full space-y-1">
            <label
              htmlFor="home-profile-preferred-schedule-notes"
              className="text-sm font-medium"
            >
              {t('homeProfile.preferredScheduleNotes')}
            </label>
            <textarea
              id="home-profile-preferred-schedule-notes"
              placeholder="Optional notes about preferred schedule"
              value={form.preferredScheduleNotes}
              onChange={(e) =>
                handleChange('preferredScheduleNotes', e.target.value)
              }
              disabled={saving}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.preferredScheduleNotes ? (
              <p className="text-sm text-destructive">
                {errors.preferredScheduleNotes}
              </p>
            ) : null}
          </div>
        </CardContent>

        <div className="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
          <Button
            type="button"
            onClick={onSubmit}
            isLoading={saving}
            disabled={saving || !isDirty}
          >
            {t('homeProfile.saveChanges')}
          </Button>
        </div>
      </Card>
    </div>
  );
};

HomeProfilePage.displayName = 'HomeProfilePage';
