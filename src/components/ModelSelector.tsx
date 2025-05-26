import { getModelGroups } from "../config/models";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  userTier?: "free" | "pro";
  className?: string;
  disabled?: boolean;
}

export default function ModelSelector({
  value,
  onChange,
  userTier = "free",
  className = "",
  disabled = false,
}: ModelSelectorProps) {
  const modelGroups = getModelGroups(userTier);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-no-repeat bg-right disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
        backgroundPosition: "right 0.75rem center",
        backgroundSize: "1.5em 1.5em",
      }}
    >
      {modelGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.models.map((model) => (
            <option
              key={model.id}
              value={model.id}
              disabled={model.id.startsWith("pro-placeholder")}
            >
              {model.displayName}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
