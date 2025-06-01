// src/App.tsx
import React, { Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
} from "react-router-dom";
import Home from "./components/Home";
import { useAuth } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";

// Lazy load heavy components
const Dashboard = React.lazy(() => import("./components/Dashboard"));
const Explore = React.lazy(() => import("./components/Explore"));
const ConversationChat = React.lazy(
  () => import("./components/ConversationChat")
);
const CreateCharacter = React.lazy(
  () => import("./components/CreateCharacter")
);
const AccountSettings = React.lazy(
  () => import("./components/AccountSettings")
);
const SubscriptionPlans = React.lazy(
  () => import("./components/SubscriptionPlans")
);
const Admin = React.lazy(() => import("./components/Admin"));

// Keep small/essential components as regular imports
import CharacterLayout from "./components/CharacterLayout";
import AuthSuccess from "./components/AuthSuccess";
import SetupUsername from "./components/SetupUsername";
import UsernamePromptModal from "./components/UsernamePromptModal";
import Test from "./components/Test";
import MarkdownTest from "./components/MarkdownTest";
import AdminLogin from "./components/AdminLogin";

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-800">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );
}

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
      {
        path: "explore",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Explore />
          </Suspense>
        ),
      },
      { path: "test", element: <Test /> },
      { path: "markdown-test", element: <MarkdownTest /> },
      {
        path: "dashboard",
        element: <ProtectedRoute />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <Dashboard />
              </Suspense>
            ),
          },
          {
            path: "create-character",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <CreateCharacter />
              </Suspense>
            ),
          },
          {
            path: "characters/:characterId",
            element: <CharacterLayout />,
            children: [
              { index: true, element: <CharacterRedirect /> },
              { path: "conversations", element: <CharacterRedirect /> },
              {
                path: "conversations/:conversationId",
                element: (
                  <Suspense fallback={<LoadingFallback />}>
                    <ConversationChat />
                  </Suspense>
                ),
              },
            ],
          },
        ],
      },
      {
        path: "settings",
        element: <ProtectedRoute />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <AccountSettings />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "plans",
        element: <ProtectedRoute />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <SubscriptionPlans />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "admin",
        element: <ProtectedAdminRoute />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <Admin />
              </Suspense>
            ),
          },
        ],
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
    <div className="min-h-screen bg-zinc-800">
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
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
