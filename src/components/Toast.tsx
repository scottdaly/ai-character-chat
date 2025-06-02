import { useEffect, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
  duration?: number;
  location?:
    | "top-right"
    | "top-left"
    | "top-center"
    | "bottom-right"
    | "bottom-left"
    | "bottom-center";
}

export default function Toast({
  message,
  type,
  onClose,
  duration = 3000,
  location = "top-right",
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
    <div
      className={`fixed ${
        location === "top-right"
          ? "top-4 right-4"
          : location === "top-left"
          ? "top-4 left-4"
          : location === "top-center"
          ? "top-4 left-1/2 translate-x-[-25%]"
          : location === "bottom-right"
          ? "bottom-4 right-4"
          : location === "bottom-left"
          ? "bottom-4 left-4"
          : "bottom-4 left-1/2 translate-x-[-25%]"
      } z-50`}
    >
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
