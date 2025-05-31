import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiUpload, FiX } from "react-icons/fi";
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image file must be less than 5MB");
        return;
      }

      setImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  // Remove selected image
  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

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

      // Create FormData for character with optional image
      const formData = new FormData();
      formData.append("name", newCharacter.name);
      formData.append("description", newCharacter.description);
      formData.append("model", newCharacter.model);
      formData.append("systemPrompt", newCharacter.systemPrompt);
      formData.append("isPublic", newCharacter.isPublic.toString());

      if (imageFile) {
        formData.append("image", imageFile);
      }

      // Note: This assumes the createCharacter function can handle FormData
      // You may need to update the API call to handle file uploads
      await createCharacter(formData);
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
    <div className="fixed inset-0 text-gray-100 overflow-y-auto">
      <Navbar
        subscriptionTier={subscriptionTier}
        isLoadingSubscription={isLoadingSubscription}
      />

      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-1 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 cursor-pointer hover:bg-zinc-900 rounded-lg transition-colors"
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
              className="text-zinc-300 text-sm font-semibold"
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
              className="w-full bg-zinc-700/60 border border-zinc-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full bg-zinc-700/60 border border-zinc-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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

          {/* Image Upload Field */}
          <div className="flex flex-col gap-2">
            <label className="text-zinc-400 text-sm font-semibold">
              Character Image (Optional)
            </label>

            {imagePreview ? (
              <div className="relative">
                <div className="w-32 h-32 overflow-hidden rounded-lg border border-zinc-600">
                  <img
                    src={imagePreview}
                    alt="Character preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-1 -right-1 p-0.5 bg-red-600 hover:bg-red-700 rounded-full text-white transition-colors"
                >
                  <FiX size={14} />
                </button>
              </div>
            ) : (
              <label className="w-full h-32 border-2 border-dashed border-zinc-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 hover:bg-zinc-800/30 transition-colors">
                <FiUpload size={24} className="text-zinc-400 mb-2" />
                <span className="text-zinc-400 text-sm">
                  Click to upload image
                </span>
                <span className="text-zinc-500 text-xs mt-1">
                  PNG, JPG up to 5MB
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}

            <p className="text-sm text-zinc-500">
              Add an optional image that will be displayed on the character
              card.
            </p>
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
              className="w-full bg-zinc-700/60 border border-zinc-600 rounded-lg pl-3 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-no-repeat bg-right"
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
              className="w-full bg-zinc-700/60 border border-zinc-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
              className="flex-1 cursor-pointer px-6 py-3 rounded-lg text-zinc-100 border border-zinc-600 hover:bg-zinc-900 hover:border-zinc-900 hover:text-white transition-colors duration-300 ease-in-out font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 cursor-pointer px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors duration-200 ease-in-out font-medium"
            >
              {isLoading ? "Creating..." : "Create Character"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
