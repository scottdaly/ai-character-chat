import { FiX } from "react-icons/fi";
import { useRef } from "react";

interface ConfirmUsernameChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  newUsername: string;
  currentUsername: string;
}

export default function ConfirmUsernameChangeModal({
  isOpen,
  onClose,
  onConfirm,
  newUsername,
  currentUsername,
}: ConfirmUsernameChangeModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Only close if the click was directly on the overlay
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className="bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Change Username</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to change your username from{" "}
            <span className="font-medium">@{currentUsername}</span> to{" "}
            <span className="font-medium">@{newUsername}</span>?
          </p>

          <p className="text-sm text-gray-400">
            This change will be visible to other users and will affect how they
            can mention you.
          </p>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Confirm Change
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
