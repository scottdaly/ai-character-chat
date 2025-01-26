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

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'auth-success', element: <AuthSuccess /> },
      { path: 'setup-username', element: <SetupUsername /> },
      {
        path: 'dashboard',
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'explore', element: <Explore /> },
          {
            path: 'characters/:characterId',
            element: <CharacterLayout />,
            children: [
              { path: 'conversations', element: <ConversationList /> },
              { path: 'conversations/:conversationId', element: <ConversationChat /> }
            ]
          }
        ]
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
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {user && !user.username && <UsernamePromptModal />}
      <Outlet />
    </div>
  );
}

export default function App() {
  return <RouterProvider router={router} />;
}