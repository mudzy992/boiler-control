import { Layout, Spin } from "antd";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";

const { Content} = Layout;

const UserLayout = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // redirect logika
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
    if (user) {
    navigate("/",); // redirect na dashboard
    }
  }, [loading, user, navigate]);

if (user) {
  navigate("/", { replace: true }); // redirect na dashboard
}
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    // React router će navigirati, ali moramo render fallback
    return null;
  }

  return (
    <Layout className="min-w-screen! min-h-screen!">
      <Layout>
        <AppHeader />
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
        <AppFooter />
      </Layout>
    </Layout>
  );
};

export default UserLayout;
