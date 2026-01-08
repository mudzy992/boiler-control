import { Dropdown, Button, type MenuProps, Layout } from "antd";
import { useAuth } from "../auth/useAuth";
import { Link, useNavigate } from "react-router-dom";

const { Header } = Layout;

const AppHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items: MenuProps["items"] = [
    {
      key: "dashboard",
      label: "Dashboard",
      onClick: () => navigate("/dashboard"),
    },
    {
      key: "profile",
      label: "Profile",
      onClick: () => navigate("/profile"),
    },
    {
      key: "logout",
      label: "Logout",
      onClick: () => {
        logout();
        navigate("/login");
      },
    },
  ];

  return (
    <Header className="flex flex-row justify-between">
        <div
        className="text-xl font-bold cursor-pointer flex items-center text-white"
        onClick={() => navigate("/")}
      >
        Boiler Dashboard
      </div>

      <div>
        {!user ? (
          <div className="flex flex-row gap-3">
            <Link to={"/login"}>
              Login
            </Link>
            <Link to={"/register"}>
              Register
            </Link>
          </div>
        ) : (
          <Dropdown menu={{ items }} placement="bottomRight" arrow>
            <Button>{user.name ?? "User"}</Button>
          </Dropdown>
        )}
      </div>
    </Header>

  );
};

export default AppHeader;
