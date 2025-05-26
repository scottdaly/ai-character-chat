import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { useCharacters } from "../api/characters";
import { Character } from "../types";
import { getModelGroups, getDefaultModel } from "../config/models";
import Navbar from "./Navbar";

export default function CreateCharacter() {
  const { user, subscriptionTier, isLoadingSubscription } = useAuth();
  const navigate = useNavigate();
  const { createCharacter } = useCharacters();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newCharacter, setNewCharacter] = useState<Omit<Character, "id">>({
    name: "",
    description: "",
    model: getDefaultModel((subscriptionTier as "free" | "pro") || "free"),
    systemPrompt: "",
    createdAt: new Date(),
    UserId: user?.id || "",
    isPublic: false,
    messageCount: 0,
  });

  // Update default model when subscription tier changes
  useEffect(() => {
    setNewCharacter((prev) => ({
      ...prev,
      model: getDefaultModel((subscriptionTier as "free" | "pro") || "free"),
    }));
  }, [subscriptionTier]);

  const modelGroups = getModelGroups(
    (subscriptionTier as "free" | "pro") || "free"
  );

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!newCharacter.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!newCharacter.systemPrompt.trim()) {
      setError("System prompt is required");
      return;
    }

    try {
      setIsLoading(true);
      await createCharacter(newCharacter);
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to create character:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create character"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-900 text-gray-100 overflow-y-auto">
      <Navbar
        subscriptionTier={subscriptionTier}
        isLoadingSubscription={isLoadingSubscription}
      />

      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-1 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-3xl font-bold">Create New Character</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateCharacter} className="space-y-5 pb-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="name"
              className="text-zinc-400 text-sm font-semibold"
            >
              Name *
            </label>
            <input
              id="name"
              type="text"
              placeholder="Enter character name"
              value={newCharacter.name}
              onChange={(e) =>
                setNewCharacter({ ...newCharacter, name: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="description"
              className="text-zinc-400 text-sm font-semibold"
            >
              Description
            </label>
            <textarea
              id="description"
              placeholder="Describe your character (optional)"
              value={newCharacter.description}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 120) {
                  setNewCharacter({ ...newCharacter, description: value });
                }
              }}
              maxLength={120}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="flex justify-between">
              <div className="text-sm text-zinc-400">
                This will be shown on the character card.
              </div>
              <div className="text-sm text-zinc-400 text-end">
                {newCharacter.description.length}/120 characters
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="model"
              className="text-zinc-400 text-sm font-semibold"
            >
              AI Model
            </label>
            <select
              id="model"
              value={newCharacter.model}
              onChange={(e) =>
                setNewCharacter({ ...newCharacter, model: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-no-repeat bg-right"
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
            {subscriptionTier === "free" && (
              <p className="text-sm text-zinc-500">
                Free tier includes limited models.{" "}
                <span
                  className="text-blue-400 cursor-pointer"
                  onClick={() => navigate("/plans")}
                >
                  Upgrade to Pro
                </span>{" "}
                for access to the most powerful models.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="systemPrompt"
              className="text-zinc-400 text-sm font-semibold"
            >
              System Prompt *
            </label>
            <textarea
              id="systemPrompt"
              placeholder="Define your character's personality, role, and behavior..."
              value={newCharacter.systemPrompt}
              onChange={(e) =>
                setNewCharacter({
                  ...newCharacter,
                  systemPrompt: e.target.value,
                })
              }
              rows={8}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
            <p className="text-sm text-zinc-500">
              This defines how your character will behave and respond. Be
              specific about their personality, expertise, and communication
              style.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={newCharacter.isPublic}
                onChange={(e) =>
                  setNewCharacter({
                    ...newCharacter,
                    isPublic: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <div className="flex flex-col">
              <span className="text-zinc-300 font-medium">Make Public</span>
              <span className="text-sm text-zinc-500">
                Allow other users to discover and chat with this character
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex-1 px-6 py-3 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? "Creating..." : "Create Character"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
