import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { StatusBanner } from '@/shared/components/status-banner';
import { Button } from '@/shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/Card';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';

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
    <div className="flex min-h-screen items-center justify-center bg-background bg-cockpit-radial px-6">
      <Card className="w-full max-w-md border-border/80 shadow-glow-soft" variant="elevated">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 shadow-glow">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
          </div>
          <CardTitle className="text-display font-semibold tracking-tight">
            {t('shell.brand')}
          </CardTitle>
          <CardDescription>{t('auth.loginTitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {submitError ? (
              <StatusBanner variant="error" message={submitError} />
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="login-identifier">{t('auth.emailOrUsername')}</Label>
              <Input
                id="login-identifier"
                autoComplete="username"
                placeholder={t('auth.emailOrUsernamePlaceholder')}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">{t('auth.password')}</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder={t('auth.password')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isLoading}
              />
            </div>
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
        </CardContent>
      </Card>
    </div>
  );
};

LoginPage.displayName = 'LoginPage';
