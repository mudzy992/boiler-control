import { useState, type JSX } from 'react';
import { BellRing, Smartphone, Tv } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/services/api';
import { PageHeader } from '@/shared/components/page-header';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';

type DeviceKind = 'PHONE' | 'TV';
interface PushResult { success: boolean; sent: number; message: string }

export const AdminPushTestPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [kind, setKind] = useState<DeviceKind>('PHONE');
  const [title, setTitle] = useState(t('adminPush.defaultTitle'));
  const [message, setMessage] = useState(t('adminPush.defaultMessage'));
  const [result, setResult] = useState<PushResult | null>(null);
  const mutation = useMutation({
    mutationFn: () => apiClient.post<PushResult>('/notifications/admin/test-device', { kind, title, message }),
    onSuccess: setResult,
    onError: (error: Error) => setResult({ success: false, sent: 0, message: error.message }),
  });
  const valid = title.trim().length > 0 && message.trim().length > 0;
  const previewIcon = kind === 'PHONE' ? <Smartphone className="h-5 w-5" aria-hidden /> : <Tv className="h-5 w-5" aria-hidden />;

  return <div className="space-y-6">
    <PageHeader title={t('adminPush.title')} description={t('adminPush.subtitle')} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <Card><CardContent className="space-y-5 pt-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">{t('adminPush.deviceLabel')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['PHONE', 'TV'] as const).map((device) => <label key={device} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${kind === device ? 'border-signal bg-raised' : 'border-border'}`}>
              <input type="radio" name="push-device" value={device} checked={kind === device} onChange={() => { setKind(device); setResult(null); }} />
              {device === 'PHONE' ? <Smartphone className="h-5 w-5" aria-hidden /> : <Tv className="h-5 w-5" aria-hidden />}
              <span className="font-medium">{t(device === 'PHONE' ? 'adminPush.phone' : 'adminPush.tv')}</span>
            </label>)}
          </div>
          <p className="text-xs text-ink-muted">{t('adminPush.targetHint')}</p>
        </fieldset>
        <label className="block space-y-1.5"><span className="text-sm font-medium">{t('adminPush.titleLabel')}</span>
          <input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-control border border-border bg-canvas px-3 py-2 text-sm text-ink" />
        </label>
        <label className="block space-y-1.5"><span className="text-sm font-medium">{t('adminPush.messageLabel')}</span>
          <textarea value={message} maxLength={500} rows={4} onChange={(event) => setMessage(event.target.value)} className="w-full resize-y rounded-control border border-border bg-canvas px-3 py-2 text-sm text-ink" />
        </label>
        <Button type="button" disabled={!valid || mutation.isPending} onClick={() => { setResult(null); mutation.mutate(); }}>
          <BellRing className="mr-2 h-4 w-4" aria-hidden />{mutation.isPending ? t('adminPush.sending') : t('adminPush.send')}
        </Button>
        {result ? <p role="status" className={result.success ? 'text-sm text-success' : 'text-sm text-danger'}>{result.message}</p> : null}
      </CardContent></Card>

      <Card><CardContent className="space-y-4 pt-5">
        <div><h2 className="font-semibold text-ink">{t('adminPush.previewTitle')}</h2><p className="mt-1 text-sm text-ink-muted">{t('adminPush.previewHint')}</p></div>
        <div className="rounded-panel border border-border bg-raised p-4" aria-label={t('adminPush.previewTitle')}>
          <div className="flex items-start gap-3"> <div className="rounded-lg bg-signal/15 p-2 text-signal">{previewIcon}</div>
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-ink">Boiler Control</span><span className="text-xs text-ink-muted">{t('adminPush.now')}</span></div>
              <p className="mt-2 font-semibold text-ink">{title || t('adminPush.previewTitlePlaceholder')}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-muted">{message || t('adminPush.previewMessagePlaceholder')}</p>
            </div>
          </div>
          <p className="mt-3 border-t border-border pt-2 text-xs text-ink-muted">{t('adminPush.previewTarget', { target: t(kind === 'PHONE' ? 'adminPush.phone' : 'adminPush.tv') })}</p>
        </div>
        <div className="rounded-lg bg-canvas p-3 text-sm text-ink-muted">{t('adminPush.safetyNote')}</div>
      </CardContent></Card>
    </div>
  </div>;
};

AdminPushTestPage.displayName = 'AdminPushTestPage';
