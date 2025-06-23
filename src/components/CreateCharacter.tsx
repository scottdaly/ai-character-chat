import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiUpload, FiX, FiLock, FiGlobe } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { Character } from "../types";
import { CHARACTER_CATEGORIES } from "../config/models";
import Navbar from "./Navbar";
import SegmentedControl from "./SegmentedControl";

export default function CreateCharacter() {
  const { user, subscriptionTier, isLoadingSubscription } = useAuth();
  const navigate = useNavigate();
  const { createUserCharacter } = useData();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>("casual-chat");
  const [newCharacter, setNewCharacter] = useState<Omit<Character, "id">>({
    name: "",
    description: "",
    model: "", // Will be set by backend based on category
    systemPrompt: "",
    createdAt: new Date(),
    UserId: user?.id || "",
    isPublic: true,
    messageCount: 0,
  });


  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Process image file (shared between drag and click upload)
  const processImageFile = (file: File) => {
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
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((file) => file.type.startsWith("image/"));

    if (imageFile) {
      processImageFile(imageFile);
    } else if (files.length > 0) {
      setError("Please drop a valid image file");
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
      formData.append("category", selectedCategory);
      formData.append("systemPrompt", newCharacter.systemPrompt);
      formData.append("isPublic", newCharacter.isPublic.toString());

      if (imageFile) {
        formData.append("image", imageFile);
      }

      // Note: This assumes the createUserCharacter function can handle FormData
      // You may need to update the API call to handle file uploads
      await createUserCharacter(formData);
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
    <div className="fixed inset-0 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-gray-100 overflow-y-auto">
      <Navbar
        subscriptionTier={subscriptionTier}
        isLoadingSubscription={isLoadingSubscription}
      />

      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-1 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 cursor-pointer text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-3xl font-bold">Create New Character</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateCharacter} className="space-y-5 pb-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="name"
              className="text-zinc-600 dark:text-zinc-300 text-sm font-semibold"
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
              className="w-full bg-zinc-100 dark:bg-zinc-700/60 border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-900 dark:text-white"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="description"
              className="text-zinc-500 dark:text-zinc-400 text-sm font-semibold"
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
              className="w-full bg-zinc-100 dark:bg-zinc-700/60 border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-zinc-900 dark:text-white"
            />
            <div className="flex justify-between">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                This will be shown on the character card.
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400 text-end">
                {newCharacter.description.length}/120 characters
              </div>
            </div>
          </div>

          {/* Image Upload Field */}
          <div className="flex flex-col gap-2">
            <label className="text-zinc-500 dark:text-zinc-400 text-sm font-semibold">
              Character Image (Optional)
            </label>

            {imagePreview ? (
              <div className="relative w-32 h-32">
                <div className="w-full h-full overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-600">
                  <img
                    src={imagePreview}
                    alt="Character preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 cursor-pointer p-1 group/removePicture text-white transition-colors flex items-center justify-center"
                >
                  <div className="flex items-center justify-center w-6 h-6 bg-zinc-700 border border-zinc-600 p-1 group-hover/removePicture:bg-red-700 group-hover/removePicture:border-red-700 rounded-full text-white transition-colors shadow-lg">
                    <FiX size={14} />
                  </div>
                </button>
              </div>
            ) : (
              <label
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ${
                  isDragging
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-400 dark:border-zinc-600 hover:border-zinc-500 dark:hover:border-zinc-500 bg-zinc-100 dark:bg-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                  <FiUpload className="w-8 h-8 mb-4 text-zinc-500 dark:text-zinc-400" />
                  <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    PNG, JPG, or GIF (MAX. 5MB)
                  </p>
                </div>
                <input
                  id="dropzone-file"
                  type="file"
                  className="hidden"
                  onChange={handleImageChange}
                  accept="image/*"
                />
              </label>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="systemPrompt"
              className="text-zinc-500 dark:text-zinc-400 text-sm font-semibold"
            >
              System Prompt *
            </label>
            <textarea
              id="systemPrompt"
              placeholder="Instructions for the AI, e.g., 'You are a helpful assistant.'"
              value={newCharacter.systemPrompt}
              onChange={(e) =>
                setNewCharacter({
                  ...newCharacter,
                  systemPrompt: e.target.value,
                })
              }
              rows={6}
              className="w-full bg-zinc-100 dark:bg-zinc-700/60 border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-zinc-900 dark:text-white"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="category"
              className="text-zinc-500 dark:text-zinc-400 text-sm font-semibold"
            >
              Category
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-700/60 border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-900 dark:text-white"
            >
              {CHARACTER_CATEGORIES.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                  className="font-normal bg-white dark:bg-zinc-700"
                >
                  {category.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {CHARACTER_CATEGORIES.find((c) => c.id === selectedCategory)?.description}
            </p>
          </div>

          {/* Visibility Control */}
          <div className="flex flex-col gap-2">
            <label className="text-zinc-500 dark:text-zinc-400 text-sm font-semibold">
              Visibility
            </label>
            <SegmentedControl
              options={[
                {
                  value: "private",
                  label: "Private",
                  icon: <FiLock size={14} />,
                },
                {
                  value: "public",
                  label: "Public",
                  icon: <FiGlobe size={14} />,
                },
              ]}
              value={newCharacter.isPublic ? "public" : "private"}
              onChange={(value) =>
                setNewCharacter({
                  ...newCharacter,
                  isPublic: value === "public",
                })
              }
              fullWidth
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {newCharacter.isPublic
                ? "Anyone can discover and chat with this character"
                : "Only you can access this character"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-gray-300 bg-transparent rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? "Creating..." : "Create Character"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
