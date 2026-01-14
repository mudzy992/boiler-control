import { useEffect, useState } from "react";
import { Card, Form, Input, Button, Spin, message, Divider, Select } from "antd";
import type { HomeProfileDashboard } from "../interfaces/Dashboard";
import { getUserProfile, updateUserProfile } from "../api/user.api";
import { getHomeProfiles, updateHomeProfile } from "../api/homeProfile.api";
import type { UpdateUser } from "../interfaces/UpdateUser";
import type { UpdateHomeProfile } from "../interfaces/HomeProfile";

const { Option } = Select;

const insulationOptions = [
  { label: "EPS", value: "EPS" },
  { label: "Kamena vuna", value: "Wool" },
];

const windowOptions = [
  { label: "Dvoslojno", value: "DOUBLE" },
  { label: "Troslojno", value: "TRIPLE" },
];

const heatingOptions = [
  { label: "Radijatorsko", value: "radiator" },
  { label: "Podno", value: "underfloor" },
  { label: "Kombinovano", value: "combined" },
];

const ProfilePage = () => {
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingHome, setSavingHome] = useState(false);

  const [user, setUser] = useState<UpdateUser | null>(null);
  const [homeProfile, setHomeProfile] = useState<HomeProfileDashboard | null>(null);

  const [userForm] = Form.useForm<UpdateUser>();
  const [homeForm] = Form.useForm<UpdateHomeProfile>();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const u = await getUserProfile();
        const userDto: UpdateUser = {
          name: u.name ?? "",
          homeLocation: u.homeLocation ?? ""
        };
        setUser(userDto);
        userForm.setFieldsValue(userDto);

        const homes = await getHomeProfiles();
        if (homes.length > 0) {
          setHomeProfile(homes[0]);
          homeForm.setFieldsValue(homes[0]);
        }
      } catch (err: any) {
        message.error("Neuspješno učitavanje profila: " + (err?.message ?? ""));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userForm, homeForm]);

  const handleUserSubmit = async (values: UpdateUser) => {
    try {
      setSavingUser(true);
      const updated = await updateUserProfile(values);
      setUser({
        name: updated.name ?? "",
        homeLocation: updated.homeLocation ?? ""
      });
      message.success("Korisnički profil uspješno sačuvan");
    } catch {
      message.error("Neuspješno ažuriranje korisničkog profila");
    } finally {
      setSavingUser(false);
    }
  };

  const handleHomeSubmit = async (values: Partial<UpdateHomeProfile>) => {
    if (!homeProfile) return;
    try {
      setSavingHome(true);
      const updated = await updateHomeProfile(homeProfile.id, values);
      setHomeProfile(updated);
      message.success("Podaci o stanu uspješno sačuvani");
    } catch {
      message.error("Neuspješno ažuriranje podataka o stanu");
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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* KORISNIK */}
      <Card title={`Korisnički profil: ${user?.name ?? "N/A"}`}>
        <Form form={userForm} layout="vertical" onFinish={handleUserSubmit}>
          <Form.Item label="Ime i prezime" name="name">
            <Input placeholder="Ime i prezime" />
          </Form.Item>
          <Form.Item label="Lokacija doma" name="homeLocation">
            <Input placeholder="Lokacija doma" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={savingUser}>
              Sačuvaj
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Divider />

      {/* HOME PROFILE */}
      {homeProfile ? (
        <Card title={`Podaci o stanu: ${homeProfile.id}`}>
          <Form form={homeForm} layout="vertical" onFinish={handleHomeSubmit}>
            <Form.Item label="Površina (m²)" name="floorArea">
              <Input type="number" />
            </Form.Item>
            <Form.Item label="Visina plafona (cm)" name="ceilingHeight">
              <Input type="number" />
            </Form.Item>
            <Form.Item label="Tip izolacije" name="insulationType">
              <Select>
                {insulationOptions.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Debljina izolacije (cm)" name="insulationThickness">
              <Input type="number" />
            </Form.Item>
            <Form.Item label="Tip prozora" name="windowType">
              <Select>
                {windowOptions.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Tip grijanja" name="heatingType">
              <Select>
                {heatingOptions.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Godina izgradnje" name="constructionYear">
              <Input type="number" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={savingHome}>
                Sačuvaj
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ) : (
        <Card>Nema podataka o stanu</Card>
      )}
    </div>
  );
};

export default ProfilePage;
