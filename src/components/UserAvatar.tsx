import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { FiSettings, FiLogOut, FiSun, FiMoon, FiMonitor } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import LogoutModal from "./LogoutModal";

interface UserAvatarProps {
  size?: "sm" | "md" | "lg";
  showDropdown?: boolean;
  className?: string;
}

export default function UserAvatar({
  size = "md",
  showDropdown = true,
  className = "",
}: UserAvatarProps) {
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Size variants
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

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

  const handleAvatarClick = () => {
    if (showDropdown) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={handleAvatarClick}
          className={`flex items-center justify-center ${
            sizeClasses[size]
          } rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            showDropdown ? "cursor-pointer" : "cursor-default"
          }`}
        >
          {user?.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={user.displayName || user.username || "User"}
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
                  <filter id={`noise-${size}`}>
                    <feTurbulence
                      type="fractalNoise"
                      baseFrequency="0.65"
                      numOctaves="3"
                      stitchTiles="stitch"
                    />
                    <feColorMatrix type="saturate" values="0" />
                  </filter>
                  <rect
                    width="100%"
                    height="100%"
                    filter={`url(#noise-${size})`}
                  />
                </svg>
              </div>
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {showDropdown && isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-lg py-1 z-50 border border-zinc-200 dark:border-zinc-700">
            <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <p className="text-sm font-medium text-zinc-800 dark:text-white">
                {user?.displayName || user?.username}
              </p>
              <p className="text-xs text-zinc-500 dark:text-gray-400 truncate">
                {user?.email}
              </p>
            </div>

            <div className="py-1">
              <div className="px-4 py-2 text-xs text-zinc-500 dark:text-gray-400">
                Theme
              </div>
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center w-full px-4 py-2 text-sm ${
                  theme === "light"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-700 dark:text-gray-300"
                } hover:bg-zinc-100 dark:hover:bg-zinc-700`}
              >
                <FiSun className="mr-2" /> Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center w-full px-4 py-2 text-sm ${
                  theme === "dark"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-700 dark:text-gray-300"
                } hover:bg-zinc-100 dark:hover:bg-zinc-700`}
              >
                <FiMoon className="mr-2" /> Dark
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`flex items-center w-full px-4 py-2 text-sm ${
                  theme === "system"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-700 dark:text-gray-300"
                } hover:bg-zinc-100 dark:hover:bg-zinc-700`}
              >
                <FiMonitor className="mr-2" /> System
              </button>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-700 py-1">
              <Link
                to="/settings"
                className="flex items-center px-4 py-2 text-sm text-zinc-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                onClick={() => setIsDropdownOpen(false)}
              >
                <FiSettings className="mr-2" />
                Account Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm text-zinc-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <FiLogOut className="mr-2" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
}
