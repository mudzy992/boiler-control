import React from 'react';
import { Form, Input, Button, Card, message, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values: { identifier: string; password: string }) => {
    try {
      await login(values.identifier, values.password);
      message.success(t('auth.loginSuccess'));
      navigate('/dashboard');
    } catch (error) {
      message.error(t('auth.loginError'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-orange-50 px-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Card className="w-full max-w-md shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">🔥 Boiler Control</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('auth.loginTitle')}</p>
        </div>

        <Spin spinning={isLoading}>
          <Form form={form} onFinish={onFinish} layout="vertical">
            <Form.Item
              name="identifier"
              rules={[
                { required: true, message: t('auth.identifierRequired') },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('auth.emailOrUsernamePlaceholder')}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: t('auth.passwordRequired') }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('auth.password')} size="large" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
                {t('auth.signIn')}
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};
