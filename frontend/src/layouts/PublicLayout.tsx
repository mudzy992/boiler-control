import { Layout, Spin } from "antd";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useEffect } from "react";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";

const { Content } = Layout;

const PublicLayout = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // redirect ako je korisnik već ulogovan
  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || user) {
    // spinner dok čekamo ili dok redirect traje
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
