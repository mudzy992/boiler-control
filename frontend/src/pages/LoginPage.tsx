import React from 'react';
import { Form, Input, Button, Card, message, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values: { identifier: string; password: string }) => {
    try {
      await login(values.identifier, values.password);
      message.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      message.error('Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-orange-50 px-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Card className="w-full max-w-md shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">🔥 Boiler Control</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Login to your account</p>
        </div>

        <Spin spinning={isLoading}>
          <Form form={form} onFinish={onFinish} layout="vertical">
            <Form.Item
              name="identifier"
              rules={[
                { required: true, message: 'Please input your email or username!' },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Email or username"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};
