import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { InputNumber } from '../../../components/InputNumber';
import { apiClient } from '../../../services/api';

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
}

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<UserProfile>({
    id: 0,
    email: '',
    username: '',
    name: '',
    homeLocation: '',
    timezone: '',
    locale: '',
    gasPriceExVat: undefined,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await apiClient.getUserProfile();
        setProfile(loaded);
        setForm({ ...loaded, gasPriceExVat: loaded.gasPriceExVat ?? undefined });
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleChange = useCallback(
    (field: keyof UserProfile, value: string | number | undefined) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setSaveStatus('idle');
    },
    [],
  );

  const onFinish = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      // Exclude email from update (it's read-only)
      const { email, ...updateData } = form;
      await apiClient.updateUserProfile(updateData as Omit<UserProfile, 'email'>);
      setProfile((prev) => (prev ? { ...prev, ...updateData } : prev));
      setSaveStatus('ok');
    } catch (error) {
      console.error('Failed to update profile:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [form, profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-border rounded-full animate-spin border-t-brand"></div>
      </div>
    );
  }

  const gasPriceInclVat =
    typeof form.gasPriceExVat === 'number'
      ? Number(form.gasPriceExVat * 1.17).toFixed(4)
      : null;

  return (
    <div className="space-y-6" id="content">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Profile
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Update your account details and preferences.
        </p>
      </div>

      {saveStatus === 'ok' && (
        <div className="p-3 rounded-lg border border-success bg-success-50 text-success-700 dark:border-success dark:bg-success-900/20 dark:text-success-100 text-sm">
          Profile updated.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="p-3 rounded-lg border border-error bg-error-50 text-error-700 dark:border-error dark:bg-error-900/20 dark:text-error-100 text-sm">
          Failed to update profile.
        </div>
      )}

      <Card padding="md" elevated>
        <div className="space-y-4">
          <div>
            <Input
              label="Name"
              placeholder="Your name"
              value={form.name ?? ''}
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={saving}
            />
            <Input
              label="Username"
              placeholder="username"
              value={form.username ?? ''}
              onChange={(e) => handleChange('username', e.target.value)}
              disabled={saving}
            />
            <Input
              label="Email"
              placeholder="email@example.com"
              value={form.email}
              disabled
            />
            <Input
              label="Home Location"
              placeholder="City, Country"
              value={form.homeLocation ?? ''}
              onChange={(e) => handleChange('homeLocation', e.target.value)}
              disabled={saving}
            />
            <Input
              label="Timezone"
              placeholder="Europe/Sarajevo"
              value={form.timezone ?? ''}
              onChange={(e) => handleChange('timezone', e.target.value)}
              disabled={saving}
            />
            <Input
              label="Locale"
              placeholder="en-US"
              value={form.locale ?? ''}
              onChange={(e) => handleChange('locale', e.target.value)}
              disabled={saving}
            />
            <InputNumber
              label="Gas Price per m³ (Ex VAT)"
              placeholder="0.0000"
              value={form.gasPriceExVat ?? undefined}
              min={0}
              step={0.0001}
              precision={4}
              onChange={(value) =>
                handleChange(
                  'gasPriceExVat',
                  typeof value === 'number' ? value : undefined,
                )
              }
              disabled={saving}
            />
          </div>

          <div className="pt-2 border-t border-border space-y-1">
            <p className="text-xs text-text-secondary dark:text-dark-text-secondary">
              VAT: 17% | Price incl VAT:{' '}
              {gasPriceInclVat !== null ? gasPriceInclVat : '—'}
            </p>
            <p className="text-xs text-text-secondary dark:text-dark-text-secondary">
              Last update:{' '}
              {form.gasPriceLastUpdatedAt
                ? new Date(form.gasPriceLastUpdatedAt).toLocaleDateString()
                : '—'}{' | '}Source:{' '}
              {form.gasPriceSource || '—'}
            </p>
          </div>

          <Button
            variant="primary"
            type="submit"
            onClick={onFinish}
            isLoading={saving}
            disabled={saving}
            fullWidth
          >
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
};

ProfilePage.displayName = 'ProfilePage';
