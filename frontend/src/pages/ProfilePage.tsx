import { useEffect, useState } from "react";
import { Card, Form, Input, Button, Spin, message, Divider } from "antd";
import type { HomeProfileDashboard } from "../interfaces/Dashboard";
import { getUserProfile, updateUserProfile } from "../api/user.api";
import { getHomeProfiles, updateHomeProfile } from "../api/homeProfile.api";
import type { UpdateUser } from "../interfaces/UpdateUser";
import type { UpdateHomeProfile } from "../interfaces/HomeProfile";

const ProfilePage = () => {
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingHome, setSavingHome] = useState(false);

  const [user, setUser] = useState<UpdateUser | null>(null);
  const [homeProfile, setHomeProfile] = useState<HomeProfileDashboard | null>(null);

  const [userForm] = Form.useForm<UpdateUser>();
  const [homeForm] = Form.useForm<UpdateHomeProfile>();

  // Load data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const u = await getUserProfile();
        const userDto: UpdateUser = {
            name: u.name ?? "",
            homeLocation: u.homeLoacation ?? ""
        }
        setUser(userDto);
        userForm.setFieldsValue(userDto);

        const homes = await getHomeProfiles();
        if (homes.length > 0) {
          setHomeProfile(homes[0]);
          homeForm.setFieldsValue(homes[0]);
        }
      } catch (err: any) {
        message.error("Failed to load profile data", err?.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userForm, homeForm]);

  // Handle user update
  const handleUserSubmit = async (values: UpdateUser) => {
    try {
      setSavingUser(true);
      const updated = await updateUserProfile(values);
      const userDto : UpdateUser = {
        name: updated.name || "",
        homeLocation: updated.homeLoacation || ""
      }
      setUser(userDto);
      message.success("User updated successfully");
    } catch {
      message.error("Failed to update user");
    } finally {
      setSavingUser(false);
    }
  };

  // Handle home profile update
  const handleHomeSubmit = async (values: Partial<UpdateHomeProfile>) => {
    if (!homeProfile) return;
    try {
      setSavingHome(true);
      const updated = await updateHomeProfile(homeProfile.id, values);
      setHomeProfile(updated);
      message.success("Home profile updated successfully");
    } catch {
      message.error("Failed to update home profile");
    } finally {
      setSavingHome(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* USER PROFILE */}
      <Card title={`User Profile: ${user?.name ?? "N/A"}`}>
        <Form form={userForm} layout="vertical" onFinish={handleUserSubmit}>
          <Form.Item label="Name" name="name">
            <Input placeholder="Name" />
          </Form.Item>
          <Form.Item label="Home Location" name="homeLocation">
            <Input placeholder="Home Location" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={savingUser}>
              Save
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Divider />

      {/* HOME PROFILE */}
      {homeProfile ? (
        <Card title={`Home Profile: ${homeProfile.id}`}>
          <Form form={homeForm} layout="vertical" onFinish={handleHomeSubmit}>
            <Form.Item label="Floor Area (m²)" name="floorArea">
              <Input type="number" />
            </Form.Item>
            <Form.Item label="Ceiling Height (cm)" name="ceilingHeight">
              <Input type="number" />
            </Form.Item>
            <Form.Item label="Insulation Type" name="insulationType">
              <Input />
            </Form.Item>
            <Form.Item label="Insulation Thickness (cm)" name="insulationThickness">
              <Input type="number" />
            </Form.Item>
            <Form.Item label="Window Type" name="windowType">
              <Input />
            </Form.Item>
            <Form.Item label="Heating Type" name="heatingType">
              <Input />
            </Form.Item>
            <Form.Item label="Construction Year" name="constructionYear">
              <Input type="number" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={savingHome}>
                Save
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ) : (
        <Card>No home profiles found</Card>
      )}
    </div>
  );
};

export default ProfilePage;
