// src/components/CharacterLayout.tsx
import { useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { FiSettings, FiX } from "react-icons/fi";
import ConversationList from "./ConversationList";
import { useCharacter } from "../api/characters";
import { useAuth } from "../contexts/AuthContext";
import { SidebarProvider, useSidebar } from "../contexts/SidebarContext";
import CharacterSettings from "./CharacterSettings";
import ConfirmationModal from "./ConfirmationModal";
import Toast from "./Toast";
import { useConversations } from "../api/conversations";
import { getModelAlias } from "./CharacterCard";

function CharacterLayoutContent() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { character } = useCharacter(characterId!);
  const { deleteConversation } = useConversations(characterId!);
  const [showSettings, setShowSettings] = useState(false);
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();

  // Delete conversation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<
    string | null
  >(null);

  // Toast state for notifications
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    location?:
      | "top-right"
      | "top-left"
      | "top-center"
      | "bottom-right"
      | "bottom-left"
      | "bottom-center";
  } | null>(null);

  // Improved ownership check to handle both string and number types
  const isOwner =
    user?.id && character?.UserId
      ? String(user.id) === String(character.UserId)
      : false;

  // Handle delete conversation
  const handleDeleteConversation = (conversationId: string) => {
    setConversationToDelete(conversationId);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!conversationToDelete) return;

    try {
      await deleteConversation(conversationToDelete);

      // Show success toast
      setToast({
        message: "Conversation deleted successfully",
        type: "success",
        location: "top-center",
      });

      // If we're currently viewing this conversation, navigate to a new one
      if (window.location.pathname.includes(conversationToDelete)) {
        const tempId = `temp-${Date.now()}`;
        navigate(
          `/dashboard/characters/${characterId}/conversations/${tempId}`
        );
      }

      // Close the modal and clear the conversation to delete
      setDeleteModalOpen(false);
      setConversationToDelete(null);
    } catch (error) {
      console.error("Failed to delete conversation:", error);

      // Show error toast
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to delete conversation";
      setToast({
        message: errorMessage,
        type: "error",
        location: "top-center",
      });
    }
  };

  return (
    <div className="flex h-screen bg-mainBG w-full">
      {/* Conversation List Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 w-72  border-r bg-mainBG-dark border-zinc-800 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 z-40`}
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-8">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex cursor-pointer items-center gap-2 text-zinc-100 instrument-serif-regular hover:text-zinc-100 transition-colors duration-300 ease-in-out text-3xl"
            >
              <img src="/favicon.svg" alt="Nevermade" className="w-4 mt-1.5" />
              Nevermade
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>
          <div className="flex flex-row justify-between items-center">
            <div className="flex flex-row items-center gap-3">
              {/* Character Image */}
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-600 bg-zinc-700 flex-shrink-0">
                {character?.image ? (
                  <img
                    src={character.image}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center">
                    <span className="text-zinc-300 text-xs font-medium">
                      {character?.name?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
              </div>

              {/* Character Info */}
              <div className="flex flex-col min-w-0 flex-1">
                <h2 className="text-lg font-semibold truncate">
                  {character?.name}
                </h2>
                <p className="text-sm text-gray-300 truncate">
                  {character?.model && getModelAlias(character.model)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isOwner && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-3 rounded-xl text-gray-300 bg-zinc-800 hover:text-zinc-100 hover:bg-zinc-700/80 transition-colors cursor-pointer"
                  title="Edit character settings"
                >
                  <FiSettings />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto minimal-dark-scrollbar">
          <ConversationList onDeleteConversation={handleDeleteConversation} />
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

      {/* Delete Conversation Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setConversationToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation? This action cannot be undone."
      />

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          location={toast.location}
        />
      )}
    </div>
  );
}

export default function CharacterLayout() {
  return (
    <SidebarProvider>
      <CharacterLayoutContent />
    </SidebarProvider>
  );
}
