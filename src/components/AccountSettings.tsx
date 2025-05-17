import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { FiUpload, FiX } from "react-icons/fi";
import Navbar from "./Navbar";
import RemoveProfilePictureModal from "./RemoveProfilePictureModal";
import Toast from "./Toast";

export default function AccountSettings() {
  const { user, apiFetch, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    console.log("1. handleFileSelect called");
    const file = event.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    console.log("2. File selected:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Validate file type
    if (!file.type.startsWith("image/")) {
      console.log("3a. Invalid file type");
      setToast({ message: "Please select an image file", type: "error" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.log("3b. File too large");
      setToast({ message: "Image must be less than 5MB", type: "error" });
      return;
    }

    try {
      console.log("4. Starting upload process");
      setIsLoading(true);

      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;
        console.log(
          "5. Image converted to base64, length:",
          base64Image.length
        );

        try {
          // Upload to server
          console.log("6. Sending request to server...");
          const response = await apiFetch("/api/profile", {
            method: "PUT",
            body: JSON.stringify({ profilePicture: base64Image }),
          });
          console.log("7. Server response:", response);

          // Update local user state with new profile picture
          if (response.success && response.profilePicture && user) {
            console.log("8. Updating user state");
            updateUser({
              id: user.id,
              displayName: user.displayName,
              email: user.email,
              username: user.username,
              isAdmin: user.isAdmin,
              profilePicture: response.profilePicture,
            });

            console.log("9. Setting success toast");
            // Use a callback to ensure we're working with the latest state
            setToast((prevToast) => {
              console.log(
                "Setting toast with message:",
                "Profile picture updated successfully"
              );
              return {
                message: "Profile picture updated successfully",
                type: "success",
              };
            });
          } else {
            console.log("8a. Response validation failed:", {
              success: response.success,
              hasProfilePicture: !!response.profilePicture,
              hasUser: !!user,
            });
          }
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
          setToast({
            message:
              uploadError instanceof Error
                ? uploadError.message
                : "Failed to update profile picture",
            type: "error",
          });
        }
      };

      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        setToast({ message: "Failed to read the image file", type: "error" });
      };

      console.log("4a. Starting to read file...");
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("General error:", err);
      setToast({
        message:
          err instanceof Error
            ? err.message
            : "Failed to update profile picture",
        type: "error",
      });
    } finally {
      console.log("11. Finishing upload process");
      setIsLoading(false);
    }
  };

  // Update the useEffect to be more informative
  useEffect(() => {
    if (toast) {
      console.log("Toast state changed to:", toast);
    } else {
      console.log("Toast state cleared");
    }
  }, [toast]);

  const handleUploadClick = () => {
    console.log("Upload button clicked");
    // Create a new file input element
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    // Add the change event listener
    input.onchange = (e) => {
      console.log("File input onChange triggered");
      const event = e as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(event);
    };

    // Trigger the file input
    input.click();
  };

  const handleRemoveClick = () => {
    setIsRemoveModalOpen(true);
  };

  const removeProfilePicture = async () => {
    try {
      setIsLoading(true);

      const response = await apiFetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ profilePicture: null }),
      });

      // Update local user state
      if (response.success && user) {
        updateUser({
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          username: user.username,
          isAdmin: user.isAdmin,
          profilePicture: null,
        });
      }

      setToast({
        message: "Profile picture removed successfully",
        type: "success",
      });
      setIsRemoveModalOpen(false);
    } catch (err) {
      setToast({
        message:
          err instanceof Error
            ? err.message
            : "Failed to remove profile picture",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-900 overflow-y-auto dark-scrollbar">
      {/* Header */}
      <Navbar />

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

          {/* Profile Picture Section */}
          <div className="bg-zinc-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Profile Picture</h2>

            <div className="flex items-center gap-6">
              {/* Current Profile Picture */}
              <div className="relative">
                {user?.profilePicture ? (
                  <div className="relative group">
                    <img
                      src={user.profilePicture}
                      alt={user.displayName}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                    <button
                      onClick={handleRemoveClick}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <FiX className="text-white text-xl scale-50 group-hover:scale-100 transition-all duration-300 ease-in-out" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-medium">
                    {user?.username?.[0].toUpperCase() ||
                      user?.email?.[0].toUpperCase() ||
                      "U"}
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div>
                <button
                  onClick={handleUploadClick}
                  disabled={isLoading}
                  className="flex items-center cursor-pointer gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-black rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiUpload />
                  {isLoading ? "Uploading..." : "Upload New Picture"}
                </button>
                <p className="text-sm text-gray-400 mt-2">
                  Max file size: 5MB. Supported formats: JPG, PNG, GIF
                </p>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="bg-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Display Name
                </label>
                <p className="text-lg">{user?.displayName}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Username
                </label>
                <p className="text-lg">@{user?.username}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Email
                </label>
                <p className="text-lg">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RemoveProfilePictureModal
        isOpen={isRemoveModalOpen}
        onClose={() => setIsRemoveModalOpen(false)}
        onConfirm={removeProfilePicture}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
