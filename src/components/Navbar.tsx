import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { FiSettings, FiLogOut, FiMenu, FiX } from "react-icons/fi";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [path.pathname]);

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
    <>
      <div className="p-4 md:py-4 md:px-0 flex items-center justify-between w-full max-w-6xl mx-auto">
        {/* Mobile hamburger menu button */}
        <div className="flex items-center gap-4 w-[25%]">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex items-center justify-center w-10 h-10 text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <FiMenu size={24} />
          </button>

          {/* Logo - completely hidden on mobile */}
          <Link
            to="/dashboard"
            className="hidden md:flex flex-row items-center gap-1 text-3xl instrument-serif-regular"
          >
            <svg
              width="155"
              height="267"
              viewBox="0 0 155 267"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8"
            >
              <path
                d="M142.666 3.46669C132.132 7.73336 119.466 16.9334 101.866 33.0667C76.2658 56.4 68.9324 62.2667 47.0658 76.8C18.2658 96 5.59909 109.867 2.53242 125.6L1.73242 130H8.26576C22.5324 130 35.0658 124.267 69.1991 102C80.7991 94.5334 95.4658 85.7334 101.866 82.4C114.532 76 134.399 69.2 144.932 67.6C151.066 66.8 151.999 66.2667 153.066 62.6667C155.066 56.1334 154.932 15.6 152.799 7.60002C151.866 3.86669 150.666 0.666685 150.266 0.800018C149.732 0.800018 146.399 2.00002 142.666 3.46669Z"
                fill="white"
              />
              <path
                d="M122 85.4667C105.2 89.8667 91.3334 98.8 66.6667 121.067C59.4667 127.467 46.6667 137.733 38.1334 143.867C29.6 150 19.7333 158.133 16.2667 161.867C1.73335 177.333 -3.19999 199.467 2.66668 222.4C3.46668 225.333 4.13335 225.867 6.53335 225.2C21.7333 220.533 35.6 211.867 48.4 199.067C57.7334 189.733 66.2667 177.6 80.5334 153.067C92.1334 133.067 100.667 122.667 112 114.667C123.2 106.667 132.133 103.2 144.667 102.133L154.667 101.333V93.3334C154.667 85.6 154.533 85.3334 150.667 84.5334C143.6 82.9334 129.6 83.4667 122 85.4667Z"
                fill="white"
              />
              <path
                d="M139.467 130.8C129.067 133.6 116.8 140 107.867 147.2C91.2003 160.533 82.2669 175.333 67.4669 214.4C57.0669 241.733 53.8669 247.6 43.4669 257.867L34.9336 266.4L42.2669 265.6C57.0669 264.133 67.6003 255.733 88.6669 228.667C101.334 212.533 112.4 201.067 132.4 183.6C148.667 169.333 153.6 159.6 154.267 139.6L154.667 128.667L150.667 128.8C148.534 128.8 143.467 129.733 139.467 130.8Z"
                fill="white"
              />
            </svg>
            NeverMade
          </Link>
        </div>

        {/* Desktop navigation */}
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

        {/* Right side - subscription badge and avatar */}
        <div className="flex h-full items-center justify-end gap-3 w-[25%]">
          {subscriptionTier === "pro" ? (
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs whitespace-nowrap">
              Pro Plan
            </span>
          ) : (
            <Link
              to="/plans"
              className="flex items-center px-3 py-1 border border-zinc-700 bg-transparent rounded-full text-xs whitespace-nowrap hover:bg-zinc-800 transition-colors"
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
      </div>

      {/* Mobile slide-out menu */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Menu panel */}
        <div
          className={`absolute left-0 top-0 h-full w-80 bg-zinc-900 border-r border-zinc-700 transform transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Menu header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-700">
            <Link
              to="/dashboard"
              className="flex flex-row items-center gap-2 text-2xl instrument-serif-regular"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <svg
                width="155"
                height="267"
                viewBox="0 0 155 267"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7"
              >
                <path
                  d="M142.666 3.46669C132.132 7.73336 119.466 16.9334 101.866 33.0667C76.2658 56.4 68.9324 62.2667 47.0658 76.8C18.2658 96 5.59909 109.867 2.53242 125.6L1.73242 130H8.26576C22.5324 130 35.0658 124.267 69.1991 102C80.7991 94.5334 95.4658 85.7334 101.866 82.4C114.532 76 134.399 69.2 144.932 67.6C151.066 66.8 151.999 66.2667 153.066 62.6667C155.066 56.1334 154.932 15.6 152.799 7.60002C151.866 3.86669 150.666 0.666685 150.266 0.800018C149.732 0.800018 146.399 2.00002 142.666 3.46669Z"
                  fill="white"
                />
                <path
                  d="M122 85.4667C105.2 89.8667 91.3334 98.8 66.6667 121.067C59.4667 127.467 46.6667 137.733 38.1334 143.867C29.6 150 19.7333 158.133 16.2667 161.867C1.73335 177.333 -3.19999 199.467 2.66668 222.4C3.46668 225.333 4.13335 225.867 6.53335 225.2C21.7333 220.533 35.6 211.867 48.4 199.067C57.7334 189.733 66.2667 177.6 80.5334 153.067C92.1334 133.067 100.667 122.667 112 114.667C123.2 106.667 132.133 103.2 144.667 102.133L154.667 101.333V93.3334C154.667 85.6 154.533 85.3334 150.667 84.5334C143.6 82.9334 129.6 83.4667 122 85.4667Z"
                  fill="white"
                />
                <path
                  d="M139.467 130.8C129.067 133.6 116.8 140 107.867 147.2C91.2003 160.533 82.2669 175.333 67.4669 214.4C57.0669 241.733 53.8669 247.6 43.4669 257.867L34.9336 266.4L42.2669 265.6C57.0669 264.133 67.6003 255.733 88.6669 228.667C101.334 212.533 112.4 201.067 132.4 183.6C148.667 169.333 153.6 159.6 154.267 139.6L154.667 128.667L150.667 128.8C148.534 128.8 143.467 129.733 139.467 130.8Z"
                  fill="white"
                />
              </svg>
              NeverMade
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center w-10 h-10 text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Navigation items */}
          <div className="p-4 space-y-2">
            <Link
              to="/dashboard"
              className={`flex items-center px-4 py-3 rounded-lg text-lg instrument-serif-regular transition-all duration-300 ${
                path.pathname === "/dashboard"
                  ? "text-white bg-gradient-to-r from-zinc-700 to-zinc-600"
                  : "text-gray-300 hover:text-white hover:bg-zinc-800"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              to="/explore"
              className={`flex items-center px-4 py-3 rounded-lg text-lg instrument-serif-regular transition-all duration-300 ${
                path.pathname === "/explore"
                  ? "text-white bg-gradient-to-r from-zinc-700 to-zinc-600"
                  : "text-gray-300 hover:text-white hover:bg-zinc-800"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Explore
            </Link>
            <Link
              to="/plans"
              className={`flex items-center px-4 py-3 rounded-lg text-lg instrument-serif-regular transition-all duration-300 ${
                path.pathname === "/plans"
                  ? "text-white bg-gradient-to-r from-zinc-700 to-zinc-600"
                  : "text-gray-300 hover:text-white hover:bg-zinc-800"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Plans
            </Link>
          </div>

          {/* User section */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full overflow-hidden">
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
                        <filter id="noise-mobile">
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
                          filter="url(#noise-mobile)"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  {user?.displayName}
                </p>
                <p className="text-xs text-gray-400">@{user?.username}</p>
                <div className="mt-1">
                  {subscriptionTier === "pro" ? (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                      Pro Plan
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-zinc-700 text-gray-300 rounded-full text-xs">
                      Free Plan
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                to="/settings"
                className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FiSettings className="mr-3" />
                Account Settings
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors"
              >
                <FiLogOut className="mr-3" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
}
