import React from "react";

interface TooltipProps {
  children: React.ReactNode;
  text: string;
  offsetSize?: "small" | "medium" | "large";
  show?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  text,
  offsetSize = "medium",
  show = true,
}) => {
  return (
    <div className="relative tooltip-group">
      {children}
      <div
        className={`tooltip-content absolute top-full ${
          offsetSize === "small"
            ? "mt-0"
            : offsetSize === "medium"
            ? "mt-2"
            : "mt-3"
        } left-1/2 transform px-2 py-1 -translate-x-1/2 bg-black  text-white text-xs rounded-md whitespace-nowrap opacity-0 transition-all duration-200 ease-in-out pointer-events-none z-50 border border-zinc-900
        ${show ? "" : "hidden"}`}
      >
        {text}
      </div>
    </div>
  );
};

export default Tooltip;
