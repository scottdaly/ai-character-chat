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
    <div className="py-4 px-2">
      <div className="px-2">
        <button
          onClick={handleNewConversation}
          className="w-full cursor-pointer border border-zinc-700 hover:bg-zinc-800 text-white py-2 px-4 rounded-lg mb-4 flex items-center justify-center gap-2 transition-colors duration-300 ease-in-out"
        >
          <FiPlus /> New Conversation
        </button>
      </div>

      <div className="space-y-1">
        {conversations.map((convo) => {
          const isSelected = location.pathname.endsWith(
            `/conversations/${convo.id}`
          );
          return (
            <Link
              key={convo.id}
              to={`/dashboard/characters/${characterId}/conversations/${convo.id}`}
              className={`block px-2 py-1 rounded-lg transition-colors relative group
                ${isSelected ? "bg-zinc-700/60" : "hover:bg-zinc-800"}`}
            >
              <h4 className="font-medium text-sm">{convo.title}</h4>
              <p className="text-xs text-zinc-400 line-clamp-1">
                {convo.lastMessage || "New conversation"}
              </p>
              {/* <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>{new Date(convo.createdAt).toLocaleDateString()}</span>
                <button
                  onClick={(e) => handleDelete(e, convo.id)}
                  className="p-1.5 rounded-lg cursor-pointer text-gray-400 hover:text-red-400 hover:bg-black/50 md:opacity-0 md:group-hover:opacity-100 transition-all"
                  title="Delete conversation"
                >
                  <FiTrash2 />
                </button>
              </div> */}
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
