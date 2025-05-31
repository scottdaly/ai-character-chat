import { useState } from "react";
import { FiX, FiUpload } from "react-icons/fi";
import { Character } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { getModelGroups } from "../config/models";

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

  // For admin users, show all models. For regular users, we'll assume pro tier for now
  // In a real app, you'd want to pass the user's subscription tier as a prop
  const modelGroups = getModelGroups(user?.isAdmin ? "pro" : "pro");

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
      <div className="bg-zinc-800 p-6 rounded-xl w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Edit Character</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <FiX />
          </button>
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div className="flex flex-col my-4 gap-1">
          <label htmlFor="name" className="text-zinc-400 text-sm font-semibold">
            Name
          </label>
          <input
            placeholder="Name"
            value={editedCharacter.name}
            onChange={(e) =>
              setEditedCharacter({ ...editedCharacter, name: e.target.value })
            }
            className="w-full bg-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col my-4 gap-1">
          <label
            htmlFor="description"
            className="text-zinc-400 text-sm font-semibold"
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
            className="w-full bg-zinc-700 rounded-lg px-4 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="text-sm text-gray-400 text-right">
            {editedCharacter.description.length}/120 characters
          </div>
        </div>

        {/* Image Upload Field */}
        <div className="flex flex-col my-4 gap-1">
          <label className="text-zinc-400 text-sm font-semibold">
            Character Image
          </label>

          {imagePreview ? (
            <div className="relative w-24 h-24">
              <div className="w-full h-full overflow-hidden rounded-lg border border-zinc-600">
                <img
                  src={imagePreview}
                  alt="Character preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-3 cursor-pointer p-1 group/removePicture text-white transition-colors shadow-lg flex items-center justify-center"
              >
                <div className="flex items-center justify-center w-5 h-5 bg-zinc-700 border border-zinc-600 p-1 group-hover/removePicture:bg-red-700 group-hover/removePicture:border-red-700 rounded-full text-white transition-colors shadow-lg">
                  <FiX size={12} />
                </div>
              </button>
            </div>
          ) : (
            <label
              className={`w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-600 hover:border-zinc-500 hover:bg-zinc-700/30"
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FiUpload size={20} className="text-zinc-400 mb-1" />
              <span className="text-zinc-400 text-xs">
                {isDragging
                  ? "Drop image here"
                  : "Click to upload or drag & drop"}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        <div className="flex flex-col my-4 gap-1">
          <label
            htmlFor="model"
            className="text-zinc-400 text-sm font-semibold"
          >
            Model
          </label>
          <select
            value={editedCharacter.model}
            onChange={(e) =>
              setEditedCharacter({ ...editedCharacter, model: e.target.value })
            }
            className="w-full bg-zinc-700 rounded-lg pl-3 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-right"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: "right 0.75rem center",
              backgroundSize: "1.5em 1.5em",
            }}
          >
            {modelGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex flex-col my-4 gap-1">
          <label
            htmlFor="systemPrompt"
            className="text-zinc-400 text-sm font-semibold"
          >
            System Prompt
          </label>
          <textarea
            placeholder="System Prompt"
            value={editedCharacter.systemPrompt}
            onChange={(e) =>
              setEditedCharacter({
                ...editedCharacter,
                systemPrompt: e.target.value,
              })
            }
            className="w-full bg-zinc-700 rounded-lg px-4 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center gap-1 my-6">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={editedCharacter.isPublic}
              onChange={(e) =>
                setEditedCharacter({
                  ...editedCharacter,
                  isPublic: e.target.checked,
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ml-2 text-gray-400">Public</span>
          </label>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
