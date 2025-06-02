import { useEffect, useState, useRef } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useConversations } from "../api/conversations";
import { FiPlus, FiMoreHorizontal, FiEdit3, FiTrash2 } from "react-icons/fi";

interface ConversationListProps {
  onDeleteConversation: (conversationId: string) => void;
}

export default function ConversationList({
  onDeleteConversation,
}: ConversationListProps) {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { conversations, loadConversations, updateConversationTitle } =
    useConversations(characterId!);

  // Dropdown and rename state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Refresh conversations when characterId or URL changes
  useEffect(() => {
    loadConversations();
  }, [characterId, location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNewConversation = () => {
    const tempId = `temp-${Date.now()}`;
    navigate(`/dashboard/characters/${characterId}/conversations/${tempId}`);
  };

  const handleMenuClick = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenDropdown(openDropdown === conversationId ? null : conversationId);
  };

  const handleRename = (
    e: React.MouseEvent,
    conversationId: string,
    currentTitle: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setRenamingId(conversationId);
    setRenameValue(currentTitle);
    setOpenDropdown(null);
  };

  const handleRenameSubmit = async (conversationId: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }

    try {
      await updateConversationTitle(conversationId, renameValue.trim());
      setRenamingId(null);
      setRenameValue("");
    } catch (error) {
      console.error("Failed to rename conversation:", error);
    }
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDelete = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenDropdown(null);
    onDeleteConversation(conversationId);
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
          const isRenaming = renamingId === convo.id;

          return (
            <div
              key={convo.id}
              className={`relative rounded-lg transition-colors group ${
                isSelected ? "bg-zinc-700/60" : "hover:bg-zinc-800"
              }`}
            >
              <Link
                to={`/dashboard/characters/${characterId}/conversations/${convo.id}`}
                className="block px-2 py-2 relative"
              >
                {isRenaming ? (
                  <div
                    className="space-y-1"
                    onClick={(e) => e.preventDefault()}
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleRenameSubmit(convo.id);
                        } else if (e.key === "Escape") {
                          handleRenameCancel();
                        }
                      }}
                      onBlur={() => handleRenameSubmit(convo.id)}
                      className="w-full bg-zinc-800 text-white text-sm font-medium px-2 py-1 rounded border border-zinc-600 focus:border-zinc-500 focus:outline-none"
                      autoFocus
                    />
                    <p className="text-xs text-zinc-400 line-clamp-1 pr-8">
                      {convo.lastMessage || "New conversation"}
                    </p>
                  </div>
                ) : (
                  <div className="pr-8">
                    <h4 className="font-medium text-sm line-clamp-1">
                      {convo.title}
                    </h4>
                    <p className="text-xs text-zinc-400 line-clamp-1">
                      {convo.lastMessage || "New conversation"}
                    </p>
                  </div>
                )}
              </Link>

              {/* Menu Button - Positioned outside Link to fix z-index issues */}
              {!isRenaming && (
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  <button
                    onClick={(e) => handleMenuClick(e, convo.id)}
                    className="p-1.5 rounded-lg cursor-pointer text-gray-300 hover:text-gray-100 opacity-0 group-hover:opacity-100 transition-all duration-200"
                    title="More options"
                  >
                    <FiMoreHorizontal />
                  </button>
                </div>
              )}

              {/* Dropdown Menu - Positioned outside Link with higher z-index */}
              {openDropdown === convo.id && !isRenaming && (
                <div
                  ref={dropdownRef}
                  className="absolute right-2 top-8 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg py-1 z-[60] min-w-[120px] px-1"
                >
                  <button
                    onClick={(e) => handleRename(e, convo.id, convo.title)}
                    className="w-full text-left px-2 py-2 rounded-md text-sm text-gray-300 hover:bg-zinc-700/60 hover:text-white flex items-center gap-2"
                  >
                    <FiEdit3 className="h-3 w-3" />
                    Rename
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, convo.id)}
                    className="w-full text-left px-2 py-2 rounded-md text-sm text-red-300 hover:bg-red-500/15 flex items-center gap-2"
                  >
                    <FiTrash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
