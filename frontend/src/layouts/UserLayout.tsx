import { Layout, Spin } from "antd";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";

const { Content} = Layout;

const UserLayout = () => {
  const { user, loading, initialized } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;

    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [initialized, user, navigate]);

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout className="min-h-screen!">
      <AppHeader />
      <Content >
        <Outlet />
      </Content>
      <AppFooter />
    </Layout>
  );
};


export default UserLayout;
