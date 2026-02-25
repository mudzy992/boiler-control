import React, { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Button, message, Spin, Typography } from 'antd';
import { apiClient } from '../services/api';

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
  const [form] = Form.useForm<UserProfile>();
  const watchedGasPrice = Form.useWatch('gasPriceExVat', form);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await apiClient.getUserProfile();
        form.setFieldsValue(profile);
      } catch (error) {
        message.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [form]);

  const onFinish = async (values: UserProfile) => {
    setSaving(true);
    try {
      // Exclude email from update (it's read-only)
      const { email, ...updateData } = values;
      await apiClient.updateUserProfile(updateData);
      message.success('Profile updated');
    } catch (error) {
      message.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Update your account details and preferences.
        </p>
      </div>
      <Card className="shadow-sm" title="User Profile">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="Name" name="name">
            <Input placeholder="Your name" />
          </Form.Item>
          <Form.Item label="Username" name="username">
            <Input placeholder="username" />
          </Form.Item>
          <Form.Item label="Email" name="email">
            <Input disabled />
          </Form.Item>
          <Form.Item label="Home Location" name="homeLocation">
            <Input placeholder="City, Country" />
          </Form.Item>
          <Form.Item label="Timezone" name="timezone">
            <Input placeholder="Europe/Sarajevo" />
          </Form.Item>
          <Form.Item label="Locale" name="locale">
            <Input placeholder="en-US" />
          </Form.Item>
          <Form.Item label="Gas Price per m³ (Ex VAT)" name="gasPriceExVat">
            <InputNumber min={0} step={0.0001} style={{ width: '100%' }} />
          </Form.Item>
          <Typography.Text type="secondary">
            VAT: 17% | Price incl VAT:{' '}
            {watchedGasPrice !== undefined && watchedGasPrice !== null
              ? Number(watchedGasPrice * 1.17).toFixed(4)
              : '—'}
          </Typography.Text>
          <br />
          <Typography.Text type="secondary">
            Last update:{' '}
            {form.getFieldValue('gasPriceLastUpdatedAt')
              ? new Date(form.getFieldValue('gasPriceLastUpdatedAt')).toLocaleDateString()
              : '—'}
            {' | '}Source: {form.getFieldValue('gasPriceSource') || '—'}
          </Typography.Text>
          <br />
          <Button type="primary" htmlType="submit" loading={saving}>
            Save Changes
          </Button>
        </Form>
      </Card>
    </div>
  );
};
