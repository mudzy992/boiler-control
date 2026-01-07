import { Button, Card, Form, Input, Typography, message } from "antd";
import { User, Mail, Lock } from "lucide-react";
import { register } from "../api/auth.api";
import { Link, useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

interface RegisterForm {
  name?: string;
  email: string;
  password: string;
}

const RegisterPage = () => {
  const navigate = useNavigate();

  const onFinish = async (values: RegisterForm) => {
    try {
      await register(values);
      message.success("Registracija uspješna. Dobrodošao!");
      navigate("/");
    } catch (err: any) {
      message.error(
        err?.response?.data?.message ?? "Greška prilikom registracije"
      );
    }
  };

  return (
    <Card style={{ width: 380 }}>
      <Title level={3} style={{ textAlign: "center" }}>
        Registracija
      </Title>

      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item label="Ime" name="name">
          <Input prefix={<User size={16} />} placeholder="Ime (opcionalno)" />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: "Email je obavezan" },
            { type: "email", message: "Neispravan email" },
          ]}
        >
          <Input prefix={<Mail size={16} />} />
        </Form.Item>

        <Form.Item
          label="Lozinka"
          name="password"
          rules={[
            { required: true, message: "Lozinka je obavezna" },
            { min: 6, message: "Minimalno 6 karaktera" },
          ]}
        >
          <Input.Password prefix={<Lock size={16} />} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            Registruj se
          </Button>
        </Form.Item>

        <Text type="secondary" style={{ fontSize: 12 }}>
          Već imaš nalog? <Link to="/login">Prijavi se</Link>
        </Text>
      </Form>
    </Card>
  );
};

export default RegisterPage;
