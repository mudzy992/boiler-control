import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { StatusBanner } from '@/shared/components/status-banner';
import {
  Button,
  Field,
  LogoMark,
  Panel,
  PanelBody,
  PanelHeader,
  TextInput,
} from '@/ui';

export const LoginPage = (): JSX.Element => {
  const { t } = useTranslation();
  const { login, isLoading, token, isInitializing } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isInitializing && token) {
      navigate('/dashboard', { replace: true });
    }
  }, [isInitializing, token, navigate]);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitError('');
    if (!identifier.trim()) {
      setSubmitError(t('auth.identifierRequired'));
      return;
    }
    if (!password) {
      setSubmitError(t('auth.passwordRequired'));
      return;
    }
    try {
      await login(identifier.trim(), password);
      navigate('/dashboard');
    } catch {
      setSubmitError(t('auth.loginError'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <Panel className="w-full max-w-sm">
        <PanelHeader className="flex-col items-center gap-3 py-5 text-center">
          <LogoMark size="md" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {t('shell.brand')}
            </h1>
            <p className="text-sm text-ink-muted">{t('auth.loginTitle')}</p>
          </div>
        </PanelHeader>
        <PanelBody>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {submitError ? (
              <StatusBanner variant="error" message={submitError} />
            ) : null}
            <Field id="login-identifier" label={t('auth.emailOrUsername')}>
              <TextInput
                id="login-identifier"
                autoComplete="username"
                placeholder={t('auth.emailOrUsernamePlaceholder')}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                disabled={isLoading}
              />
            </Field>
            <Field id="login-password" label={t('auth.password')}>
              <TextInput
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder={t('auth.password')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isLoading}
              />
            </Field>
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              loadingLabel={t('common.loading')}
              disabled={isLoading}
            >
              {t('auth.signIn')}
            </Button>
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
};

LoginPage.displayName = 'LoginPage';
