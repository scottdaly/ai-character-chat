import { useState } from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState("");

  const handleConfirm = () => {
    if (confirmText.toLowerCase() === "delete") {
      onConfirm();
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop itself, not the modal content
    if (e.target === e.currentTarget && !isLoading) {
      handleClose();
    }
  };

  const handleModalContentClick = (e: React.MouseEvent) => {
    // Prevent clicks inside the modal from bubbling up to the backdrop
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4 border border-zinc-700"
        onClick={handleModalContentClick}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FiAlertTriangle className="text-red-500 text-xl" />
            <h2 className="text-xl font-semibold text-white">Delete Account</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-300 mb-4">
            This action cannot be undone. This will permanently delete your
            account and remove all of your data from our servers.
          </p>
          <p className="text-gray-300 mb-4">This includes:</p>
          <ul className="text-gray-400 text-sm mb-4 space-y-1 ml-4">
            <li>• All your conversations and messages</li>
            <li>• All characters you've created</li>
            <li>• Your profile information</li>
            <li>• Your subscription (if any)</li>
          </ul>
          <p className="text-red-400 font-medium mb-4">
            To confirm, please type "delete" in the box below:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type 'delete' to confirm"
            disabled={isLoading}
            className="w-full bg-zinc-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-zinc-700 bg-transparent text-gray-300 hover:text-white hover:bg-zinc-700 cursor-pointer transition-all duration-300 ease-in-out disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || confirmText.toLowerCase() !== "delete"}
            className="px-4 py-2 border border-red-400/50 bg-red-500/80 hover:bg-red-600 cursor-pointer text-white rounded-lg hover:scale-102 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
