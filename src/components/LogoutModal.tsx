import { FiAlertCircle } from "react-icons/fi";
import { useRef, useEffect } from "react";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogoutModal({
  isOpen,
  onClose,
  onConfirm,
}: LogoutModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

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
        className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-sm w-full border border-zinc-100 dark:border-zinc-700"
      >
        <div className="flex items-center gap-2 mb-2">
          <FiAlertCircle className="text-zinc-700 dark:text-zinc-300 text-xl" />
          <h2 className="text-xl font-semibold text-zinc-700 dark:text-white">
            Confirm Logout
          </h2>
        </div>

        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Are you sure you want to log out? You'll need to log in again to
          access your account.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 cursor-pointer rounded-lg border border-zinc-200 bg-transparent text-zinc-700  hover:bg-zinc-200 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-600 transition-colors duration-300 ease-in-out"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 cursor-pointer rounded-lg bg-red-600/80 dark:bg-red-500/80 hover:bg-red-600 text-white transition-all duration-300 ease-in-out hover:scale-102"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
