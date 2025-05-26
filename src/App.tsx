// src/App.tsx
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
} from "react-router-dom";
import Home from "./components/Home";
import Dashboard from "./components/Dashboard";
import Explore from "./components/Explore";
import CharacterLayout from "./components/CharacterLayout";
import ConversationChat from "./components/ConversationChat";
import AuthSuccess from "./components/AuthSuccess";
import SetupUsername from "./components/SetupUsername";
import UsernamePromptModal from "./components/UsernamePromptModal";
import CreateCharacter from "./components/CreateCharacter";
import { useAuth } from "./contexts/AuthContext";
import Test from "./components/Test";
import Admin from "./components/Admin";
import AdminLogin from "./components/AdminLogin";
import SubscriptionPlans from "./components/SubscriptionPlans";
import AccountSettings from "./components/AccountSettings";

// Component to handle character redirect
function CharacterRedirect() {
  const tempId = `temp-${Date.now()}`;
  return <Navigate to={`conversations/${tempId}`} replace />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "auth-success", element: <AuthSuccess /> },
      { path: "setup-username", element: <SetupUsername /> },
      { path: "explore", element: <Explore /> },
      { path: "test", element: <Test /> },
      {
        path: "dashboard",
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "create-character", element: <CreateCharacter /> },
          {
            path: "characters/:characterId",
            element: <CharacterLayout />,
            children: [
              { index: true, element: <CharacterRedirect /> },
              { path: "conversations", element: <CharacterRedirect /> },
              {
                path: "conversations/:conversationId",
                element: <ConversationChat />,
              },
            ],
          },
        ],
      },
      {
        path: "settings",
        element: <ProtectedRoute />,
        children: [{ index: true, element: <AccountSettings /> }],
      },
      {
        path: "plans",
        element: <ProtectedRoute />,
        children: [{ index: true, element: <SubscriptionPlans /> }],
      },
      {
        path: "admin",
        element: <ProtectedAdminRoute />,
        children: [{ index: true, element: <Admin /> }],
      },
      {
        path: "admin-login",
        element: <AdminLogin />,
      },
    ],
  },
]);

function Layout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}

function ProtectedRoute() {
  const { user } = useAuth();

  if (!user) {
    window.location.href = "/";
    return null;
  }

  return (
    <div className="flex h-screen bg-zinc-800 text-gray-100">
      {user && !user.username && <UsernamePromptModal />}
      <Outlet />
    </div>
  );
}

function ProtectedAdminRoute() {
  const { user } = useAuth();

  if (!user?.isAdmin) {
    window.location.href = "/admin-login";
    return null;
  }

  return <Outlet />;
}

export default function App() {
  return <RouterProvider router={router} />;
}
