import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';

export const LoginPage: React.FC = () => {
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card padding="md" elevated className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-text-primary">
            🔥 Boiler Control
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {t('auth.loginTitle')}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {submitError ? (
            <div
              role="alert"
              className="p-3 rounded-lg border border-error bg-error-50 text-error-700 dark:border-error dark:bg-error-900/20 dark:text-error-100 text-sm"
            >
              {submitError}
            </div>
          ) : null}
          <Input
            label={t('auth.emailOrUsername')}
            placeholder={t('auth.emailOrUsernamePlaceholder')}
            id="login-identifier"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={isLoading}
          />
          <Input
            label={t('auth.password')}
            placeholder={t('auth.password')}
            type="password"
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          <Button
            variant="primary"
            type="submit"
            isLoading={isLoading}
            disabled={isLoading}
            fullWidth
          >
            {t('auth.signIn')}
          </Button>
        </form>
      </Card>
    </div>
  );
};

LoginPage.displayName = 'LoginPage';
