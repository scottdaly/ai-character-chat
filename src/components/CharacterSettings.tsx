import { useState } from "react";
import { FiX, FiUpload, FiLock, FiGlobe } from "react-icons/fi";
import { Character } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { getCategoryForModel, CHARACTER_CATEGORIES, getModelDisplayName } from "../config/models";
import SegmentedControl from "./SegmentedControl";

interface CharacterSettingsProps {
  character: Character;
  onClose: () => void;
  onSave: () => void;
}

export default function CharacterSettings({
  character,
  onClose,
  onSave,
}: CharacterSettingsProps) {
  const { user, apiFetch } = useAuth();
  const [editedCharacter, setEditedCharacter] = useState({
    name: character.name,
    description: character.description,
    model: character.model,
    systemPrompt: character.systemPrompt,
    isPublic: character.isPublic,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    character.image || null
  );
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Get the category for the current model
  const currentCategory = getCategoryForModel(character.model);
  const categoryInfo = CHARACTER_CATEGORIES.find(c => c.id === currentCategory);

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
    setRemoveExistingImage(false);

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

  // Remove image
  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveExistingImage(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Validate required fields
      if (!editedCharacter.name.trim()) {
        setError("Name is required");
        return;
      }

      if (!editedCharacter.systemPrompt?.trim()) {
        setError("System prompt is required");
        return;
      }

      const endpoint = user?.isAdmin
        ? `/api/admin/characters/${character.id}`
        : `/api/characters/${character.id}`;

      if (imageFile || removeExistingImage) {
        // Use FormData if there's an image to upload or remove
        const formData = new FormData();
        formData.append("name", editedCharacter.name);
        formData.append("description", editedCharacter.description);
        formData.append("model", editedCharacter.model);
        formData.append("systemPrompt", editedCharacter.systemPrompt);
        formData.append("isPublic", editedCharacter.isPublic.toString());

        if (imageFile) {
          formData.append("image", imageFile);
        } else if (removeExistingImage) {
          formData.append("removeImage", "true");
        }

        await apiFetch(endpoint, {
          method: "PUT",
          body: formData,
        });
      } else {
        // Use JSON if no image changes
        await apiFetch(endpoint, {
          method: "PUT",
          body: JSON.stringify(editedCharacter),
        });
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
      console.error("Failed to save character:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-6 rounded-xl w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Edit Character
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-600 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <FiX />
          </button>
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div className="flex flex-col my-4 gap-1">
          <label
            htmlFor="name"
            className="text-zinc-600 dark:text-zinc-400 text-sm font-semibold"
          >
            Name
          </label>
          <input
            placeholder="Name"
            value={editedCharacter.name}
            onChange={(e) =>
              setEditedCharacter({ ...editedCharacter, name: e.target.value })
            }
            className="w-full bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-zinc-300 dark:border-transparent"
          />
        </div>

        <div className="flex flex-col my-4 gap-1">
          <label
            htmlFor="description"
            className="text-zinc-600 dark:text-zinc-400 text-sm font-semibold"
          >
            Description
          </label>
          <textarea
            placeholder="Description"
            value={editedCharacter.description}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= 120) {
                setEditedCharacter({ ...editedCharacter, description: value });
              }
            }}
            maxLength={120}
            className="w-full bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg px-4 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none border border-zinc-300 dark:border-transparent"
          />
          <div className="text-sm text-gray-500 dark:text-gray-400 text-right">
            {editedCharacter.description.length}/120 characters
          </div>
        </div>

        {/* Image Upload Field */}
        <div className="flex flex-col my-4 gap-1">
          <label className="text-zinc-600 dark:text-zinc-400 text-sm font-semibold">
            Character Image
          </label>

          {imagePreview ? (
            <div className="relative w-24 h-24">
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
                className="absolute -top-2 -right-3 cursor-pointer p-1 group/removePicture text-zinc-900 dark:text-white transition-colors flex items-center justify-center"
              >
                <div className="flex items-center justify-center w-5 h-5 bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 p-1 group-hover/removePicture:bg-red-400 dark:group-hover/removePicture:bg-red-700 group-hover/removePicture:border-red-500 dark:group-hover/removePicture:border-red-700 rounded-full text-zinc-900 dark:text-white transition-colors shadow-lg">
                  <FiX size={12} />
                </div>
              </button>
            </div>
          ) : (
            <label
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ${
                isDragging
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-400 dark:border-zinc-600 hover:border-zinc-500 dark:hover:border-zinc-500 bg-zinc-100 dark:bg-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                <FiUpload className="w-8 h-8 mb-3 text-zinc-500 dark:text-zinc-400" />
                <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold">Click to upload</span> or drag
                  and drop
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

        <div className="flex flex-col my-4 gap-1">
          <label
            htmlFor="system-prompt"
            className="text-zinc-600 dark:text-zinc-400 text-sm font-semibold"
          >
            System Prompt
          </label>
          <textarea
            id="system-prompt"
            placeholder="System Prompt"
            value={editedCharacter.systemPrompt}
            onChange={(e) =>
              setEditedCharacter({
                ...editedCharacter,
                systemPrompt: e.target.value,
              })
            }
            className="w-full bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg px-4 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none border border-zinc-300 dark:border-transparent"
          />
        </div>

        <div className="flex flex-col my-4 gap-1">
          <label
            className="text-zinc-600 dark:text-zinc-400 text-sm font-semibold"
          >
            Category
          </label>
          <div className="w-full bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg px-4 py-2 border border-zinc-300 dark:border-transparent">
            {categoryInfo?.name || "Unknown"}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {categoryInfo?.description}
          </p>
        </div>

        <div className="flex flex-col my-4 gap-1">
          <label
            className="text-zinc-600 dark:text-zinc-400 text-sm font-semibold"
          >
            Model
          </label>
          <div className="w-full bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg px-4 py-2 border border-zinc-300 dark:border-transparent">
            {getModelDisplayName(character.model)}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Model is automatically selected based on category and subscription tier
          </p>
        </div>

        {/* Visibility Control */}
        {user?.isAdmin && (
          <div className="flex flex-col gap-2 mt-4">
            <label className="text-zinc-600 dark:text-zinc-400 text-sm font-semibold">
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
              value={editedCharacter.isPublic ? "public" : "private"}
              onChange={(value) =>
                setEditedCharacter({
                  ...editedCharacter,
                  isPublic: value === "public",
                })
              }
              fullWidth
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {editedCharacter.isPublic
                ? "Anyone can discover and chat with this character"
                : "Only you can access this character"}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-gray-300 bg-transparent rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
