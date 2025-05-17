import { useRef, useEffect } from "react";
import { FiX } from "react-icons/fi";

interface RemoveProfilePictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function RemoveProfilePictureModal({
  isOpen,
  onClose,
  onConfirm,
}: RemoveProfilePictureModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div
        ref={modalRef}
        className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 w-full max-w-md relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer text-gray-400 hover:text-white"
        >
          <FiX size={20} />
        </button>

        <h2 className="text-xl font-semibold mb-4">Remove Profile Picture</h2>
        <p className="text-gray-300 mb-6">
          Are you sure you want to remove your profile picture? This action
          cannot be undone.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-700 bg-transparent text-gray-300 hover:text-white hover:bg-zinc-700 cursor-pointer transition-all duration-300 ease-in-out"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 border border-red-400/50 bg-red-500/80 hover:bg-red-600 cursor-pointer text-white rounded-lg hover:scale-102 transition-all duration-300 ease-in-out"
          >
            Remove Picture
          </button>
        </div>
      </div>
    </div>
  );
}
