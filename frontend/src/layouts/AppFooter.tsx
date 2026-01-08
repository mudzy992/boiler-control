import { Layout } from "antd";

const { Footer } = Layout;

const AppFooter = () => {
  return (
    <Footer className="text-center">
       ©{new Date().getFullYear()} Created by Mudzy
    </Footer>
  );
};

export default AppFooter;
