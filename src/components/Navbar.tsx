import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { FiSettings, FiLogOut } from "react-icons/fi";
import LogoutModal from "./LogoutModal";

interface NavbarProps {
  showUpgradeButton?: boolean;
  subscriptionTier?: string;
}

export default function Navbar({
  showUpgradeButton = true,
  subscriptionTier = "free",
}: NavbarProps) {
  const { logout, user } = useAuth();
  const path = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setIsDropdownOpen(false);
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    setIsLogoutModalOpen(false);
    logout();
  };

  // Generate a gradient background based on username
  const getGradientBackground = (username: string) => {
    const colors = [
      "from-blue-500 to-purple-500",
      "from-green-500 to-blue-500",
      "from-purple-500 to-pink-500",
      "from-yellow-500 to-red-500",
      "from-pink-500 to-orange-500",
    ];
    const hash = username
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="p-4 md:py-4 md:px-0 flex items-center justify-between w-full max-w-6xl mx-auto">
      <div className="flex items-center gap-4 w-[25%]">
        <Link to="/dashboard" className="text-3xl instrument-serif-regular">
          NeverMade
        </Link>
      </div>
      <div className="hidden md:flex items-center justify-center w-[50%] instrument-serif-regular text-lg tracking-wide">
        <Link
          to="/dashboard"
          className={`text-gray-300 hover:text-white px-5 py-1.5 rounded-full transition-all duration-300 ${
            path.pathname === "/dashboard"
              ? "text-white bg-gradient-to-tl from-zinc-700 to-zinc-600"
              : ""
          }`}
        >
          Dashboard
        </Link>
        <Link
          to="/explore"
          className={`text-gray-300 hover:text-white px-5 py-1.5 rounded-full transition-all duration-300 ${
            path.pathname === "/explore" ? "text-white bg-zinc-700" : ""
          }`}
        >
          Explore
        </Link>
        <Link
          to="/plans"
          className={`text-gray-300 hover:text-white px-5 py-1.5 rounded-full transition-all duration-300 ${
            path.pathname === "/plans" ? "text-white bg-zinc-700" : ""
          }`}
        >
          Plans
        </Link>
      </div>
      <div className="flex h-full items-center justify-end gap-3 w-[25%]">
        {subscriptionTier === "pro" ? (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
            Pro Plan
          </span>
        ) : (
          <Link
            to="/plans"
            className="flex items-center px-3 py-1 border border-zinc-700 bg-transparent rounded-full text-xs"
          >
            Free Plan
          </Link>
        )}

        {/* Avatar and Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={user.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className={`w-full h-full bg-gradient-to-br ${getGradientBackground(
                  user?.username || user?.email || "user"
                )} flex items-center justify-center text-white relative`}
              >
                <div className="absolute inset-0 opacity-30 mix-blend-overlay">
                  <svg className="w-full h-full">
                    <filter id="noise">
                      <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.65"
                        numOctaves="3"
                        stitchTiles="stitch"
                      />
                      <feColorMatrix type="saturate" values="0" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#noise)" />
                  </svg>
                </div>
              </div>
            )}
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-zinc-800 rounded-lg shadow-lg py-1 z-50 border border-zinc-700">
              <div className="px-4 py-2 border-b border-zinc-700">
                <p className="text-sm font-medium text-white">
                  {user?.displayName}
                </p>
                <p className="text-xs text-gray-400">@{user?.username}</p>
              </div>
              <Link
                to="/settings"
                className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-zinc-700 hover:text-white cursor-pointer"
              >
                <FiSettings className="mr-2" />
                Account Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-zinc-700 hover:text-white cursor-pointer"
              >
                <FiLogOut className="mr-2" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
