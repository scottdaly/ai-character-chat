// src/components/CharacterLayout.tsx
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiSettings, FiMenu, FiX } from "react-icons/fi";
import ConversationList from "./ConversationList";
import { useCharacter } from "../api/characters";
import { useAuth } from "../contexts/AuthContext";
import CharacterSettings from "./CharacterSettings";
import { getModelAlias } from "./CharacterCard";

export default function CharacterLayout() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { character } = useCharacter(characterId!);
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const isOwner = user?.id ? user.id === character?.UserId?.toString() : false;

  // Close sidebar by default on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-900 w-full">
      {/* Mobile Sidebar Toggle Button */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden fixed top-4 left-4 z-50 p-2 bg-black/50 rounded-lg text-gray-300 hover:bg-gray-700"
        >
          <FiMenu size={24} />
        </button>
      )}

      {/* Conversation List Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 w-72 bg-zinc-900 border-r border-zinc-700 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 z-40`}
      >
        <div className="p-4 border-b border-zinc-700">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-gray-300 hover:text-white"
            >
              <FiArrowLeft /> Back to Dashboard
            </button>
          </div>
          <div className="flex flex-row justify-between items-center">
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold">{character?.name}</h2>
              <p className="text-sm text-gray-400">
                {character?.model && getModelAlias(character.model)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-600 transition-colors"
                  title="Edit character settings"
                >
                  <FiSettings />
                </button>
              )}
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-600 transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto minimal-dark-scrollbar">
          <ConversationList />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1">
        <Outlet />
      </div>

      {/* Character Settings Modal */}
      {showSettings && character && (
        <CharacterSettings
          character={character}
          onClose={() => setShowSettings(false)}
          onSave={() => {
            setShowSettings(false);
            window.location.reload();
          }}
        />
      )}

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
