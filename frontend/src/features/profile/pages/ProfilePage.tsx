import { useCallback, useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/services/api';
import { DEFAULT_GAS_PRICE_VAT_RATE } from '@/constants/gas-vat';
import { PageHeader } from '@/shared/components/page-header';
import { QueryState } from '@/shared/components/query-state';
import { StatusBanner } from '@/shared/components/status-banner';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { InputNumber } from '@/components/InputNumber';

interface UserProfile {
  id: number;
  email: string;
  username?: string;
  name?: string;
  homeLocation?: string;
  timezone?: string;
  locale?: string;
  gasPriceExVat?: number;
  gasPriceIncVat?: number;
  gasPriceLastUpdatedAt?: string;
  gasPriceSource?: string;
  gasPriceVatRate?: number;
}

export const ProfilePage = (): JSX.Element => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<UserProfile>({ id: 0, email: '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const loaded = (await apiClient.getUserProfile()) as UserProfile;
      setProfile(loaded);
      setForm({ ...loaded, gasPriceExVat: loaded.gasPriceExVat ?? undefined });
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleChange = useCallback(
    (field: keyof UserProfile, value: string | number | undefined) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setSaveStatus('idle');
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!profile) {
      return;
    }
    setSaving(true);
    setSaveStatus('idle');
    try {
      const {
        email: _email,
        gasPriceIncVat: _inc,
        gasPriceLastUpdatedAt: _updated,
        gasPriceSource: _source,
        gasPriceVatRate: _vat,
        ...updateData
      } = form;
      await apiClient.updateUserProfile(updateData as Omit<UserProfile, 'email'>);
      setProfile((prev) => (prev ? { ...prev, ...updateData } : prev));
      setSaveStatus('ok');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [form, profile]);

  const vatRate = form.gasPriceVatRate ?? DEFAULT_GAS_PRICE_VAT_RATE;
  const gasPriceInclVat =
    typeof form.gasPriceExVat === 'number'
      ? Number(form.gasPriceExVat * (1 + vatRate)).toFixed(4)
      : null;

  const status = loading ? 'loading' : loadError ? 'error' : 'success';

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.profile')} description={t('profile.subtitle')} />
      {saveStatus === 'ok' ? (
        <StatusBanner variant="success" message={t('profile.saveOk')} />
      ) : null}
      {saveStatus === 'error' ? (
        <StatusBanner variant="error" message={t('profile.saveError')} />
      ) : null}
      <QueryState status={status} onRetry={() => void loadProfile()}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            {(
              [
                ['name', t('profile.name')],
                ['username', t('profile.username')],
                ['homeLocation', t('profile.homeLocation')],
                ['timezone', t('profile.timezone')],
                ['locale', t('profile.locale')],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`profile-${field}`}>{label}</Label>
                <Input
                  id={`profile-${field}`}
                  value={String(form[field] ?? '')}
                  onChange={(event) => handleChange(field, event.target.value)}
                  disabled={saving}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="profile-email">{t('profile.email')}</Label>
              <Input id="profile-email" value={form.email} disabled />
            </div>
            <InputNumber
              id="profile-gas-price"
              label={t('profile.gasPriceExVat')}
              value={form.gasPriceExVat ?? undefined}
              min={0}
              step={0.0001}
              precision={4}
              onChange={(value) => handleChange('gasPriceExVat', value ?? undefined)}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              {t('profile.vatLine', {
                rate: Math.round(vatRate * 100),
                price: gasPriceInclVat ?? '—',
              })}
            </p>
            <Button type="button" className="w-full" onClick={() => void handleSave()} isLoading={saving}>
              {t('common.save')}
            </Button>
          </CardContent>
        </Card>
      </QueryState>
    </div>
  );
};

ProfilePage.displayName = 'ProfilePage';
