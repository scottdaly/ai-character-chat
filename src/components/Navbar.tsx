import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  showUpgradeButton?: boolean;
  subscriptionTier?: string;
}

export default function Navbar({ showUpgradeButton = true, subscriptionTier = 'free' }: NavbarProps) {
  const { logout } = useAuth();

  return (
    <div className="p-4 md:py-4 md:px-0 flex items-center justify-between w-full max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-2xl font-bold hover:text-blue-400 transition-colors">
          NeverMade
        </Link>
        <div className="hidden md:flex items-center gap-4 ml-8">
          <Link to="/dashboard" className="text-gray-300 hover:text-white">
            Dashboard
          </Link>
          <Link to="/explore" className="text-gray-300 hover:text-white">
            Explore
          </Link>
          <Link to="/plans" className="text-gray-300 hover:text-white">
            Plans
          </Link>
        </div>
      </div>
      <div className="flex h-full items-center gap-4">
        {showUpgradeButton && subscriptionTier === 'pro' ? (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm">
            Pro Plan
          </span>
        ) : showUpgradeButton ? (
          <Link
            to="/plans"
            className="flex items-center px-4 py-1 h-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm"
          >
            Upgrade to Pro
          </Link>
        ) : null}
        <button
          onClick={logout}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          Logout
        </button>
      </div>
    </div>
  );
} 