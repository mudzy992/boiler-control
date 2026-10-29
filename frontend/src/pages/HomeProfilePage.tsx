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
// FE2-1: CreateHomeProfileDto i UpdateHomeProfileDto su uklonjeni — bili su
// uvezeni ali nikad korišteni (noUnusedLocals ih prijavljuje kao TS6196).
import type { HomeProfileResponse } from '../types/homeProfile';
import {
  INSULATION_TYPE_OPTIONS,
  WINDOW_TYPE_OPTIONS,
  HEATING_TYPE_OPTIONS,
  InsulationType,
  WindowType,
  HeatingType,
} from '../constants/homeProfileEnums';

interface HomeProfileFormValues {
  homeName?: string;
  floorArea: number;
  ceilingHeight: number;
  insulationType: InsulationType;
  insulationThickness: number;
  windowType: WindowType;
  heatingType: HeatingType;
  constructionYear: number;
  numberOfResidents?: number;
  boilerModel?: string;
  hasFloorHeating?: boolean;
  targetMorningTemp: number;
  targetDayTemp: number;
  targetNightTemp: number;
  preferredScheduleNotes?: string;
}

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
            floorArea: profile.floorArea,
            ceilingHeight: profile.ceilingHeight,
            insulationType: profile.insulationType,
            insulationThickness: profile.insulationThickness,
            windowType: profile.windowType,
            heatingType: profile.heatingType,
            constructionYear: profile.constructionYear,
            numberOfResidents: profile.numberOfResidents,
            boilerModel: profile.boilerModel,
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
            floorArea: 100,
            ceilingHeight: 2.6,
            insulationType: InsulationType.STANDARD,
            insulationThickness: 10,
            windowType: WindowType.DOUBLE_GLAZED,
            heatingType: HeatingType.RADIATOR,
            constructionYear: new Date().getFullYear(),
            hasFloorHeating: false,
            targetMorningTemp: 22,
            targetDayTemp: 20,
            targetNightTemp: 18,
          }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item name="homeName" label="Home Name">
                <Input placeholder="My Home" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="floorArea"
                label="Floor Area (m²)"
                rules={[{ required: true, type: 'number', min: 10, max: 2000 }]}
              >
                <InputNumber className="w-full" min={10} max={2000} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="ceilingHeight"
                label="Ceiling Height (m)"
                rules={[{ required: true, type: 'number', min: 2.0, max: 5.0 }]}
              >
                <InputNumber className="w-full" min={2.0} max={5.0} step={0.1} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="constructionYear"
                label="Construction Year"
                rules={[{ required: true, type: 'number', min: 1800, max: 2100 }]}
              >
                <InputNumber className="w-full" min={1800} max={2100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="insulationType" label="Insulation Type" rules={[{ required: true }]}>
                <Select options={INSULATION_TYPE_OPTIONS} placeholder="Select insulation type" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="insulationThickness"
                label="Insulation Thickness (cm)"
                rules={[{ required: true, type: 'number', min: 0, max: 50 }]}
              >
                <InputNumber className="w-full" min={0} max={50} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="windowType" label="Window Type" rules={[{ required: true }]}>
                <Select options={WINDOW_TYPE_OPTIONS} placeholder="Select window type" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="heatingType" label="Heating Type" rules={[{ required: true }]}>
                <Select options={HEATING_TYPE_OPTIONS} placeholder="Select heating type" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="numberOfResidents"
                label="Number of Residents"
                rules={[{ type: 'number', min: 1, max: 20 }]}
              >
                <InputNumber className="w-full" min={1} max={20} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="boilerModel" label="Boiler Model">
                <Input placeholder="Boiler model" />
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
                label="Target Morning Temp (°C)"
                rules={[{ type: 'number', min: 5, max: 30 }]}
              >
                <InputNumber className="w-full" min={5} max={30} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="targetDayTemp"
                label="Target Day Temp (°C)"
                rules={[{ type: 'number', min: 5, max: 30 }]}
              >
                <InputNumber className="w-full" min={5} max={30} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="targetNightTemp"
                label="Target Night Temp (°C)"
                rules={[{ type: 'number', min: 5, max: 30 }]}
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
