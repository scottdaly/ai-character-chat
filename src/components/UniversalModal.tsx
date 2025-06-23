import { useRef, useEffect, ReactNode } from "react";
import { FiX, FiAlertTriangle, FiAlertCircle } from "react-icons/fi";

export type ModalIcon = "alert" | "warning" | "none";
export type ModalSize = "sm" | "md" | "lg";
export type ModalButtonVariant = "primary" | "secondary" | "danger" | "success";

interface ModalButton {
  text: string;
  onClick: () => void;
  variant?: ModalButtonVariant;
  isLoading?: boolean;
  disabled?: boolean;
}

interface UniversalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  icon?: ModalIcon;
  size?: ModalSize;
  buttons?: ModalButton[];
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  hideCloseButton?: boolean;
}

export default function UniversalModal({
  isOpen,
  onClose,
  title,
  children,
  icon = "none",
  size = "md",
  buttons = [
    { text: "Cancel", onClick: () => {}, variant: "secondary" },
    { text: "Confirm", onClick: () => {}, variant: "primary" },
  ],
  closeOnBackdropClick = true,
  closeOnEscape = true,
  hideCloseButton = false,
}: UniversalModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key press
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen && closeOnEscape) {
        onClose();
      }
    };

    if (isOpen && closeOnEscape) {
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, onClose, closeOnEscape]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Determine width based on size prop
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  }[size];

  // Render appropriate icon
  const renderIcon = () => {
    switch (icon) {
      case "alert":
        return <FiAlertCircle className="text-zinc-300 text-xl" />;
      case "warning":
        return <FiAlertTriangle className="text-red-500 text-xl" />;
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={`bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-lg rounded-lg p-6 w-full ${sizeClasses} relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 cursor-pointer text-gray-400 hover:text-white transition-colors"
          >
            <FiX size={20} />
          </button>
        )}

        <div className="flex items-center gap-2 mb-2">
          {renderIcon()}
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>

        <div className="mb-6">{children}</div>

        <div className="flex justify-end gap-3">
          {buttons.map((button, index) => {
            const baseStyles =
              "px-4 py-2 rounded-lg transition-all duration-300 ease-in-out";

            // Button variant styles
            const variantStyles = {
              primary:
                "bg-zinc-800 dark:bg-zinc-100 text-white dark:text-black hover:bg-zinc-900 dark:hover:bg-zinc-200",
              secondary:
                "border border-zinc-200 dark:border-zinc-700 bg-transparent text-gray-700 dark:text-gray-300 hover:text-black hover:bg-zinc-200 dark:hover:text-white dark:hover:bg-zinc-700",
              danger:
                "border border-red-500/50 dark:border-red-400/50 bg-red-600/80 dark:bg-red-500/80 hover:bg-red-600 text-white",
              success: "bg-green-500/80 hover:bg-green-600 text-white",
            }[button.variant || "secondary"];

            const disabledStyles = button.disabled
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:scale-102";

            return (
              <button
                key={index}
                onClick={button.onClick}
                disabled={button.disabled || button.isLoading}
                className={`${baseStyles} ${variantStyles} ${disabledStyles}`}
              >
                {button.isLoading ? "Loading..." : button.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
