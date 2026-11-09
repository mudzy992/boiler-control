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
  brandOfFamily,
  catalogBrands,
  familiesForBrand,
  familyLabel,
  isKnownFamilyId,
  outputOptions,
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
  /** Snaga izvedbe; obavezna kad porodica navodi snage (`25` §5.1). */
  boilerOutputKw: number | undefined;
  /** Najviša polazna koju sistem dozvoljava (`19` §2). */
  maxHeatingFlowC: number | undefined;
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
  boilerOutputKw: undefined,
  maxHeatingFlowC: undefined,
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
            boilerOutputKw: loaded.boilerOutputKw ?? undefined,
            maxHeatingFlowC: loaded.maxHeatingFlowC ?? undefined,
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

  /**
   * Spisak onoga što backend **zaista** traži (`CreateHomeProfileDto`).
   *
   * Prije ovoga forma je tražila ime doma (koje backend ne traži) i nije
   * tražila tri ciljne temperature (koje traži). Posljedica je bila 400 na
   * ispravno popunjenoj formi. Granice ispod su iste kao u DTO-u.
   */
  const validate = useCallback(() => {
    const next: Record<string, string> = {};
    const required: Record<string, string> = {
      floorArea: t('homeProfile.floorArea'),
      ceilingHeight: t('homeProfile.ceilingHeight'),
      constructionYear: t('homeProfile.constructionYear'),
      insulationThickness: t('homeProfile.insulationThickness'),
      insulationType: t('homeProfile.insulationType'),
      windowType: t('homeProfile.windowType'),
      heatingType: t('homeProfile.heatingType'),
      targetMorningTemp: t('homeProfile.targetMorningTemp'),
      targetDayTemp: t('homeProfile.targetDayTemp'),
      targetNightTemp: t('homeProfile.targetNightTemp'),
    };

    Object.entries(required).forEach(([field, label]) => {
      const value = form[field as keyof HomeProfileFormValues];
      if (value === '' || value === undefined || value === null) {
        next[field] = t('homeProfile.required', { field: label });
      }
    });

    const ranges: Array<[string, number, number]> = [
      ['floorArea', 10, 2000],
      ['ceilingHeight', 1.8, 5],
      ['constructionYear', 1900, 2100],
      ['insulationThickness', 5, 30],
      ['numberOfResidents', 1, 20],
      ['targetMorningTemp', 5, 30],
      ['targetDayTemp', 5, 30],
      ['targetNightTemp', 5, 30],
      ['maxHeatingFlowC', 30, 55],
    ];
    ranges.forEach(([field, min, max]) => {
      const value = form[field as keyof HomeProfileFormValues] as
        | number
        | undefined;
      if (value !== undefined && (value < min || value > max)) {
        next[field] = t('homeProfile.outOfRange', { min, max });
      }
    });

    /*
     * Porodica + snaga je jedna odluka (`25` §5.1). Ako porodica navodi
     * snage, snaga je obavezna — backend to odbija, pa je bolje reći odmah i
     * na istom mjestu, umjesto „Failed to save" poslije zahtjeva.
     */
    const powers = outputOptions(catalog?.families, form.boilerCatalogId);
    if (powers && powers.length > 0) {
      if (form.boilerOutputKw === undefined) {
        next.boilerOutputKw = t('homeProfile.required', {
          field: t('homeProfile.boilerOutputKw'),
        });
      } else if (!powers.includes(form.boilerOutputKw)) {
        next.boilerOutputKw = t('homeProfile.boilerOutputKwNotInCatalog', {
          options: powers.join(', '),
        });
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [catalog, form, t]);

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
        // Snaga bez porodice je odbijena na backendu (`25` §5.1), pa se ovdje
        // ne šalje. Snaga ostaje `number`; `null` znači „nema snage".
        boilerOutputKw:
          form.boilerCatalogId === '' ? null : (form.boilerOutputKw ?? null),
        maxHeatingFlowC: form.maxHeatingFlowC ?? null,
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

  const brands = useMemo(() => catalogBrands(catalog), [catalog]);

  /*
   * Marka se pamti odvojeno od izbora modela, jer nije dio profila: profil
   * pamti porodicu, a marka je samo korak do nje. Kad se profil učita, marka se
   * izvodi iz porodice — inače bi forma otvorila prvi korak prazan i korisnik
   * bi pomislio da model nije sačuvan.
   */
  const [brandOverride, setBrandOverride] = useState<string | null>(null);
  const brand = brandOverride ?? brandOfFamily(catalog?.families, form.boilerCatalogId);
  const brandFamilies = useMemo(
    () => familiesForBrand(catalog, brand),
    [catalog, brand],
  );
  const powers = outputOptions(catalog?.families, form.boilerCatalogId);

  /** Promjena marke briše porodicu, jer porodica pripada marki. */
  const onBrandChange = useCallback(
    (value: string) => {
      setBrandOverride(value);
      setForm((prev) => ({ ...prev, boilerCatalogId: '', boilerOutputKw: undefined }));
      setErrors((prev) => ({ ...prev, boilerCatalogId: '', boilerOutputKw: '' }));
      setSaveStatus('idle');
    },
    [],
  );

  /** Promjena porodice briše snagu, jer snaga pripada porodici. */
  const onFamilyChange = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, boilerCatalogId: value, boilerOutputKw: undefined }));
    setErrors((prev) => ({ ...prev, boilerCatalogId: '', boilerOutputKw: '' }));
    setSaveStatus('idle');
  }, []);

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
      form.boilerOutputKw !== (profile.boilerOutputKw ?? undefined) ||
      form.maxHeatingFlowC !== (profile.maxHeatingFlowC ?? undefined) ||
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
          {/*
            Odabir kotla je **tri koraka**: marka → porodica/varijanta → snaga
            (`25` §5.1). Jedan padajući spisak bi nudio 13 porodica i prećutao
            pitanje „koja snaga", a snaga je ono što razlikuje VUW 246/5-3 od
            306/5-3. Nijedan korak nije kozmetika: bez porodice nema savjeta o
            snižavanju, a bez snage backend odbija zapis.
          */}
          <div className="col-span-2 space-y-3 md:col-span-1">
            <div className="space-y-1">
              <label
                htmlFor="home-profile-boiler-brand"
                className="text-sm font-medium text-text-secondary"
              >
                {t('homeProfile.boilerBrand')}
              </label>
              <Select
                id="home-profile-boiler-brand"
                value={brand}
                onChange={(e) => onBrandChange(e.target.value)}
                disabled={saving || brands.length === 0}
              >
                <option value="">{t('homeProfile.boilerBrandNone')}</option>
                {brands.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
              {errors.boilerBrand ? (
                <p className="text-xs text-error">{errors.boilerBrand}</p>
              ) : null}
            </div>

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
                onChange={(e) => onFamilyChange(e.target.value)}
                disabled={saving || brandFamilies.length === 0}
              >
                <option value="">{t('homeProfile.boilerModelNone')}</option>
                {staleFamilyId ? (
                  <option value={staleFamilyId}>
                    {t('homeProfile.boilerModelStale', { id: staleFamilyId })}
                  </option>
                ) : null}
                {brandFamilies.map((family) => (
                  <option key={family.id} value={family.id}>
                    {familyLabel(family)}
                  </option>
                ))}
              </Select>
              {errors.boilerCatalogId ? (
                <p className="text-xs text-error">{errors.boilerCatalogId}</p>
              ) : null}
            </div>

            {powers && powers.length > 0 ? (
              <div className="space-y-1">
                <label
                  htmlFor="home-profile-boiler-output"
                  className="text-sm font-medium text-text-secondary"
                >
                  {t('homeProfile.boilerOutputKw')}
                </label>
                <Select
                  id="home-profile-boiler-output"
                  value={form.boilerOutputKw === undefined ? '' : String(form.boilerOutputKw)}
                  invalid={Boolean(errors.boilerOutputKw)}
                  onChange={(e) =>
                    handleChange(
                      'boilerOutputKw',
                      e.target.value === '' ? undefined : Number(e.target.value),
                    )
                  }
                  disabled={saving}
                >
                  <option value="">{t('homeProfile.boilerOutputKwNone')}</option>
                  {powers.map((power) => (
                    <option key={power} value={power}>
                      {power} kW
                    </option>
                  ))}
                </Select>
                {errors.boilerOutputKw ? (
                  <p className="text-xs text-error">{errors.boilerOutputKw}</p>
                ) : null}
              </div>
            ) : null}

            <p className="text-xs text-text-secondary" data-testid="boiler-hint">
              {selectionHint(catalog?.families, form.boilerCatalogId)}
            </p>
            {!form.boilerCatalogId && form.boilerModel ? (
              <p className="text-xs text-text-secondary">
                {t('homeProfile.boilerModelLegacy', { model: form.boilerModel })}
              </p>
            ) : null}
          </div>
          {/*
            Najviša polazna koju sistem dozvoljava (`19` §2). Polje samo
            **sužava** raspon 30–55 — nikad ga ne širi — i zato je isti min/max
            kao predlog. Prazno znači „granica kotla", ne 55 unaprijed upisano:
            upisana vrijednost izgledala bi kao korisnikov podatak.
          */}
          <div className="space-y-1">
            <InputNumber
              label={t('homeProfile.maxHeatingFlowC')}
              placeholder="55"
              id="home-profile-max-heating-flow"
              value={form.maxHeatingFlowC}
              min={30}
              max={55}
              step={1}
              precision={0}
              error={errors.maxHeatingFlowC}
              onChange={(value) =>
                handleChange(
                  'maxHeatingFlowC',
                  typeof value === 'number' ? value : undefined,
                )
              }
              disabled={saving}
            />
            <p className="text-xs text-text-secondary">
              {t('homeProfile.maxHeatingFlowCHint')}
            </p>
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
