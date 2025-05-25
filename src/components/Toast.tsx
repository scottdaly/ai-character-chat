import { useEffect, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type,
  onClose,
  duration = 3000,
}: ToastProps) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true);
      // Wait for the slide-up animation to complete before calling onClose
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg transform transition-all duration-300 bg-zinc-800 border border-zinc-700 ${
          isClosing ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
        } ${
          type === "success"
            ? "border border-green-500/50 text-green-400"
            : " border border-red-500/50 text-red-400"
        }`}
      >
        {type === "success" ? (
          <FiCheck className="flex-shrink-0" />
        ) : (
          <FiX className="flex-shrink-0" />
        )}
        <p className="text-zinc-200">{message}</p>
      </div>
    </div>
  );
}
