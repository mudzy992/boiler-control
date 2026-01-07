import { Button, Card, Divider, Form, Input, message, Typography } from "antd";
import { Lock, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const { Title, Text } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      await login(values.email, values.password);
      message.success("Uspješna prijava");
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      message.error("Neispravni kredencijali", e);
    }
  };

  return (
    <div className="flex justify-center">
      <Card style={{ width: 360 }}>
        <Title level={3} style={{ textAlign: "center" }}>
          Prijava
        </Title>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Email je obavezan" },
              { type: "email", message: "Neispravan email" },
            ]}
          >
            <Input prefix={<User size={16} />} placeholder="email@domena.com" />
          </Form.Item>

          <Form.Item
            label="Lozinka"
            name="password"
            rules={[{ required: true, message: "Lozinka je obavezna" }]}
          >
            <Input.Password prefix={<Lock size={16} />} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Prijavi se
            </Button>
          </Form.Item>

          <Divider />

          <div className="flex flex-col items-center">
            <Text type="secondary" style={{ fontSize: 12 }}>
              Nemaš nalog? <Link to="/register">Registruj se</Link>
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              CORE system · Dashboard & Read-only
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
