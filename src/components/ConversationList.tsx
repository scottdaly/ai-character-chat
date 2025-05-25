import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useConversations } from "../api/conversations";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import ConfirmationModal from "./ConfirmationModal";

export default function ConversationList() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { conversations, loadConversations, deleteConversation } =
    useConversations(characterId!);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<
    string | null
  >(null);

  // Refresh conversations when characterId or URL changes
  useEffect(() => {
    loadConversations();
  }, [characterId, location.pathname]);

  const handleNewConversation = () => {
    const tempId = `temp-${Date.now()}`;
    navigate(`/dashboard/characters/${characterId}/conversations/${tempId}`);
  };

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Prevent event bubbling
    setConversationToDelete(conversationId);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!conversationToDelete) return;

    try {
      await deleteConversation(conversationToDelete);

      // If we're currently viewing this conversation, navigate to a new one
      if (location.pathname.includes(conversationToDelete)) {
        handleNewConversation();
      }

      // Close the modal and clear the conversation to delete
      setDeleteModalOpen(false);
      setConversationToDelete(null);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  return (
    <div className="p-4 ">
      <button
        onClick={handleNewConversation}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg mb-4 flex items-center justify-center gap-2"
      >
        <FiPlus /> New Conversation
      </button>

      <div className="space-y-2">
        {conversations.map((convo) => {
          const isSelected = location.pathname.endsWith(
            `/conversations/${convo.id}`
          );
          return (
            <Link
              key={convo.id}
              to={`/dashboard/characters/${characterId}/conversations/${convo.id}`}
              className={`block p-3 border rounded-lg transition-colors relative group
                ${
                  isSelected
                    ? "bg-gray-800 border-gray-400"
                    : "hover:bg-zinc-800 border-zinc-700"
                }`}
            >
              <h4 className="font-medium">{convo.title}</h4>
              <p className="text-sm text-gray-300 line-clamp-2">
                {convo.lastMessage || "New conversation"}
              </p>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>{new Date(convo.createdAt).toLocaleDateString()}</span>
                <button
                  onClick={(e) => handleDelete(e, convo.id)}
                  className="p-1.5 rounded-lg cursor-pointer text-gray-400 hover:text-red-400 hover:bg-black/50 md:opacity-0 md:group-hover:opacity-100 transition-all"
                  title="Delete conversation"
                >
                  <FiTrash2 />
                </button>
              </div>
            </Link>
          );
        })}
      </div>

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
    </div>
  );
}
