import { Layout, Spin } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useEffect } from "react";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";

const { Content } = Layout;

const PublicLayout = () => {
  const { user, initialized } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!initialized) return;

    if (
      user &&
      (location.pathname === "/login" ||
        location.pathname === "/register")
    ) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, initialized, location.pathname, navigate]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout className="min-h-screen! min-w-screen">
      <AppHeader />
      <Content className="max-w-7xl mx-auto p-3">
        <Outlet />
      </Content>
      <AppFooter />
    </Layout>
  );
};


export default PublicLayout;
