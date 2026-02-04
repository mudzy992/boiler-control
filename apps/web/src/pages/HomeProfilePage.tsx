import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Row,
  Col,
  message,
  Spin,
} from 'antd';
import { apiClient } from '../services/api';

interface HomeProfileFormValues {
  homeName?: string;
  squareMeters: number;
  insulationLevel: string;
  windowQuality: string;
  numberOfResidents?: number;
  boilerModel?: string;
  radiatorType: string;
  hasFloorHeating?: boolean;
  targetMorningTemp: number;
  targetDayTemp: number;
  targetNightTemp: number;
  preferredScheduleNotes?: string;
}

interface HomeProfileResponse {
  id: number;
  homeName?: string;
  squareMeters?: number;
  insulationLevel?: string;
  windowQuality?: string;
  numberOfResidents?: number;
  boilerModel?: string;
  radiatorType?: string;
  floorArea?: number;
  insulationType?: string;
  windowType?: string;
  heatingType?: string;
  hasFloorHeating?: boolean;
  targetMorningTemp?: number;
  targetDayTemp?: number;
  targetNightTemp?: number;
  preferredScheduleNotes?: string;
}

const insulationOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const windowOptions = [
  { value: 'SINGLE', label: 'Single pane' },
  { value: 'DOUBLE', label: 'Double pane' },
  { value: 'TRIPLE', label: 'Triple pane' },
];

const radiatorOptions = [
  { value: 'RADIATOR', label: 'Radiator' },
  { value: 'FLOOR', label: 'Floor Heating' },
  { value: 'MIXED', label: 'Mixed' },
];

export const HomeProfilePage: React.FC = () => {
  const [form] = Form.useForm<HomeProfileFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await apiClient.getHomeProfile();
        if (response) {
          const profile = response as HomeProfileResponse;
          setProfileId(profile.id);
          form.setFieldsValue({
            homeName: profile.homeName,
            squareMeters: profile.squareMeters ?? profile.floorArea ?? 0,
            insulationLevel: profile.insulationLevel ?? profile.insulationType ?? '',
            windowQuality: profile.windowQuality ?? profile.windowType ?? '',
            numberOfResidents: profile.numberOfResidents,
            boilerModel: profile.boilerModel,
            radiatorType: profile.radiatorType ?? profile.heatingType ?? '',
            hasFloorHeating: profile.hasFloorHeating ?? false,
            targetMorningTemp: profile.targetMorningTemp ?? 20,
            targetDayTemp: profile.targetDayTemp ?? 21,
            targetNightTemp: profile.targetNightTemp ?? 18,
            preferredScheduleNotes: profile.preferredScheduleNotes,
          });
        }
      } catch (error) {
        message.error('Failed to load home profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [form]);

  const handleSubmit = async (values: HomeProfileFormValues) => {
    try {
      setSaving(true);
      if (profileId) {
        await apiClient.updateHomeProfile(profileId, values);
        message.success('Home profile updated successfully');
      } else {
        const created = await apiClient.createHomeProfile(values);
        setProfileId(created.id);
        message.success('Home profile created successfully');
      }
    } catch (error) {
      message.error('Failed to save home profile');
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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Home Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage your home details to improve heating recommendations.
        </p>
      </div>

      <Card className="shadow-sm" title="Home Profile Details">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            hasFloorHeating: false,
          }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item name="homeName" label="Home Name" rules={[{ required: true }]}>
                <Input placeholder="My Home" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="squareMeters"
                label="Square Meters"
                rules={[{ required: true, type: 'number', min: 10, max: 2000 }]}
              >
                <InputNumber className="w-full" min={10} max={2000} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="insulationLevel" label="Insulation Level" rules={[{ required: true }]}
              >
                <Select options={insulationOptions} placeholder="Select insulation" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="windowQuality" label="Window Quality" rules={[{ required: true }]}
              >
                <Select options={windowOptions} placeholder="Select window type" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="numberOfResidents"
                label="Number of Residents"
                rules={[{ required: true, type: 'number', min: 1, max: 20 }]}
              >
                <InputNumber className="w-full" min={1} max={20} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="boilerModel" label="Boiler Model" rules={[{ required: true }]}>
                <Input placeholder="Boiler model" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="radiatorType" label="Radiator Type" rules={[{ required: true }]}
              >
                <Select options={radiatorOptions} placeholder="Select radiator type" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="hasFloorHeating" label="Has Floor Heating" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="targetMorningTemp"
                label="Target Morning Temp"
                rules={[{ required: true, type: 'number', min: 5, max: 30 }]}
              >
                <InputNumber className="w-full" min={5} max={30} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="targetDayTemp"
                label="Target Day Temp"
                rules={[{ required: true, type: 'number', min: 5, max: 30 }]}
              >
                <InputNumber className="w-full" min={5} max={30} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="targetNightTemp"
                label="Target Night Temp"
                rules={[{ required: true, type: 'number', min: 5, max: 30 }]}
              >
                <InputNumber className="w-full" min={5} max={30} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="preferredScheduleNotes" label="Preferred Schedule Notes">
                <Input.TextArea rows={3} placeholder="Optional notes about preferred schedule" />
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-end">
            <Button type="primary" htmlType="submit" loading={saving}>
              Save Changes
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};
