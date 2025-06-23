// src/components/CharacterLayout.tsx
import { useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { FiSettings, FiX } from "react-icons/fi";
import ConversationList from "./ConversationList";
import { useCharacter } from "../api/characters";
import { useAuth } from "../contexts/AuthContext";
import { SidebarProvider, useSidebar } from "../contexts/SidebarContext";
import CharacterSettings from "./CharacterSettings";
import UniversalModal from "./UniversalModal";
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
    <div className="flex h-screen bg-white dark:bg-mainBG w-full">
      {/* Conversation List Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 w-72 bg-zinc-50 dark:bg-mainBG-dark border-r border-zinc-200 dark:border-zinc-800 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 z-40`}
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-8">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex cursor-pointer items-center gap-2 text-zinc-900 dark:text-zinc-100  instrument-serif-regular hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-300 ease-in-out text-3xl"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
                width="15"
                height="26"
                className="w-4 mt-1.5"
              >
                <svg
                  width="15"
                  height="26"
                  viewBox="0 0 155 267"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="fill-zinc-900 dark:fill-zinc-100"
                >
                  <path d="M142.666 3.46669C132.132 7.73336 119.466 16.9334 101.866 33.0667C76.2658 56.4 68.9324 62.2667 47.0658 76.8C18.2658 96 5.59909 109.867 2.53242 125.6L1.73242 130H8.26576C22.5324 130 35.0658 124.267 69.1991 102C80.7991 94.5334 95.4658 85.7334 101.866 82.4C114.532 76 134.399 69.2 144.932 67.6C151.066 66.8 151.999 66.2667 153.066 62.6667C155.066 56.1334 154.932 15.6 152.799 7.60002C151.866 3.86669 150.666 0.666685 150.266 0.800018C149.732 0.800018 146.399 2.00002 142.666 3.46669Z"></path>
                  <path d="M122 85.4667C105.2 89.8667 91.3334 98.8 66.6667 121.067C59.4667 127.467 46.6667 137.733 38.1334 143.867C29.6 150 19.7333 158.133 16.2667 161.867C1.73335 177.333 -3.19999 199.467 2.66668 222.4C3.46668 225.333 4.13335 225.867 6.53335 225.2C21.7333 220.533 35.6 211.867 48.4 199.067C57.7334 189.733 66.2667 177.6 80.5334 153.067C92.1334 133.067 100.667 122.667 112 114.667C123.2 106.667 132.133 103.2 144.667 102.133L154.667 101.333V93.3334C154.667 85.6 154.533 85.3334 150.667 84.5334C143.6 82.9334 129.6 83.4667 122 85.4667Z"></path>
                  <path d="M139.467 130.8C129.067 133.6 116.8 140 107.867 147.2C91.2003 160.533 82.2669 175.333 67.4669 214.4C57.0669 241.733 53.8669 247.6 43.4669 257.867L34.9336 266.4L42.2669 265.6C57.0669 264.133 67.6003 255.733 88.6669 228.667C101.334 212.533 112.4 201.067 132.4 183.6C148.667 169.333 153.6 159.6 154.267 139.6L154.667 128.667L150.667 128.8C148.534 128.8 143.467 129.733 139.467 130.8Z"></path>
                </svg>
              </svg>
              Nevermade
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>
          <div className="flex flex-row justify-between items-center">
            <div className="flex flex-row items-center gap-3">
              {/* Character Image */}
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-600 bg-zinc-200 dark:bg-zinc-700 flex-shrink-0">
                {character?.image ? (
                  <img
                    src={character.image}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-600 dark:to-zinc-700 flex items-center justify-center">
                    <span className="text-zinc-500 dark:text-zinc-300 text-xs font-medium">
                      {character?.name?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
              </div>

              {/* Character Info */}
              <div className="flex flex-col min-w-0 flex-1">
                <h2 className="text-lg font-semibold truncate text-zinc-900 dark:text-white">
                  {character?.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-300 truncate">
                  {character?.model && getModelAlias(character.model)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isOwner && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-3 rounded-xl text-gray-600 dark:text-gray-300 bg-transparent dark:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 transition-colors cursor-pointer"
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
      <UniversalModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setConversationToDelete(null);
        }}
        title="Delete Conversation"
        icon="warning"
        buttons={[
          {
            text: "Cancel",
            onClick: () => {
              setDeleteModalOpen(false);
              setConversationToDelete(null);
            },
            variant: "secondary",
          },
          {
            text: "Delete",
            onClick: handleConfirmDelete,
            variant: "danger",
          },
        ]}
      >
        <p className="text-gray-700 dark:text-gray-300">
          Are you sure you want to delete this conversation? This action cannot
          be undone.
        </p>
      </UniversalModal>

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
