import { useState } from "react";

interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export default function SegmentedControl({
  options,
  value,
  onChange,
  className = "",
  size = "md",
  fullWidth = false,
}: SegmentedControlProps) {
  const [activeIndex, setActiveIndex] = useState(
    options.findIndex((opt) => opt.value === value)
  );

  const handleClick = (index: number, optionValue: string) => {
    setActiveIndex(index);
    onChange(optionValue);
  };

  const sizeClasses = {
    sm: "text-xs py-1.5 px-3",
    md: "text-sm py-2 px-4",
    lg: "text-base py-2.5 px-5",
  };

  const baseClasses =
    "relative inline-flex rounded-lg p-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700";
  const widthClass = fullWidth ? "w-full" : "";

  return (
    <div className={`${baseClasses} ${widthClass} ${className}`}>
      {/* Sliding background indicator */}
      <div
        className="absolute top-1 bottom-1 bg-white dark:bg-zinc-700 rounded-md shadow-sm inset-shadow-[0_1px_1px_rgba(255,255,255,0.1)] transition-all duration-200 ease-out"
        style={{
          left: `calc(${(activeIndex * 100) / options.length}% + 4px)`,
          width: `calc(${100 / options.length}% - 8px)`,
        }}
      />

      {/* Options */}
      <div className={`relative flex ${fullWidth ? "w-full" : ""}`}>
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleClick(index, option.value)}
            className={`
              ${sizeClasses[size]}
              ${fullWidth ? "flex-1" : ""}
              relative z-10 flex items-center justify-center gap-2
              font-medium transition-colors duration-200
              ${
                value === option.value
                  ? "text-zinc-900 dark:text-white"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }
            `}
          >
            {option.icon && (
              <span className="flex-shrink-0">{option.icon}</span>
            )}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
