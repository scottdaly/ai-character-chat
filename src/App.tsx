// src/App.tsx
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import Explore from './components/Explore';
import CharacterLayout from './components/CharacterLayout';
import ConversationList from './components/ConversationList';
import ConversationChat from './components/ConversationChat';
import AuthSuccess from './components/AuthSuccess';
import SetupUsername from './components/SetupUsername';
import UsernamePromptModal from './components/UsernamePromptModal';
import { useAuth } from './contexts/AuthContext';
import Test from './components/Test';
import Admin from './components/Admin';
import AdminLogin from './components/AdminLogin';
import SubscriptionPlans from './components/SubscriptionPlans';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'auth-success', element: <AuthSuccess /> },
      { path: 'setup-username', element: <SetupUsername /> },
      { path: 'explore', element: <Explore /> },
      { path: 'test', element: <Test /> },
      {
        path: 'dashboard',
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <Dashboard /> },
          {
            path: 'characters/:characterId',
            element: <CharacterLayout />,
            children: [
              { path: 'conversations', element: <ConversationList /> },
              { path: 'conversations/:conversationId', element: <ConversationChat /> }
            ]
          }
        ]
      },
      {
        path: 'plans',
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <SubscriptionPlans /> }
        ]
      },
      {
        path: 'admin',
        element: <ProtectedAdminRoute />,
        children: [
          { index: true, element: <Admin /> }
        ]
      },
      {
        path: 'admin-login',
        element: <AdminLogin />
      }
    ]
  }
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
    window.location.href = '/';
    return null;
  }

  return (
    <div className="flex h-screen bg-zinc-900 text-gray-100">
      {user && !user.username && <UsernamePromptModal />}
      <Outlet />
    </div>
  );
}

function ProtectedAdminRoute() {
  const { user } = useAuth();

  if (!user?.isAdmin) {
    window.location.href = '/admin-login';
    return null;
  }

  return <Outlet />;
}

export default function App() {
  return <RouterProvider router={router} />;
}