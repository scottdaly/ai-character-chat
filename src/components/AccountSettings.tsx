import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { FiUpload, FiX, FiEdit2, FiLoader, FiTrash2 } from "react-icons/fi";
import Navbar from "./Navbar";
import RemoveProfilePictureModal from "./RemoveProfilePictureModal";
import ConfirmUsernameChangeModal from "./ConfirmUsernameChangeModal";
import DeleteAccountModal from "./DeleteAccountModal";
import Toast from "./Toast";

export default function AccountSettings() {
  const {
    user,
    apiFetch,
    updateUser,
    subscriptionTier,
    isLoadingSubscription,
    logout,
  } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    available: boolean;
    reason?: string;
  } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const checkTimeoutRef = useRef<NodeJS.Timeout>();

  // Generate a gradient background based on username (same as Navbar)
  const getGradientBackground = (username: string) => {
    const colors = [
      "from-blue-500 to-purple-500",
      "from-green-500 to-blue-500",
      "from-purple-500 to-pink-500",
      "from-yellow-500 to-red-500",
      "from-pink-500 to-orange-500",
    ];
    const hash = username
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    console.log("1. handleFileSelect called");
    const file = event.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      setUploadError(null);
      return;
    }

    console.log("2. File selected:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Clear any previous errors
    setUploadError(null);

    // Validate file type
    if (!file.type.startsWith("image/")) {
      console.log("3a. Invalid file type");
      const errorMessage = "Please select an image file";
      setUploadError(errorMessage);
      setToast({ message: errorMessage, type: "error" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.log("3b. File too large");
      const errorMessage = "Image must be less than 5MB";
      setUploadError(errorMessage);
      setToast({ message: errorMessage, type: "error" });
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
            setToast(() => {
              return {
                message: "Profile picture updated successfully",
                type: "success",
              };
            });
            // Clear any upload errors on success
            setUploadError(null);
          } else {
            console.log("8a. Response validation failed:", {
              success: response.success,
              hasProfilePicture: !!response.profilePicture,
              hasUser: !!user,
            });
          }
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
          const errorMessage =
            uploadError instanceof Error
              ? uploadError.message
              : "Failed to update profile picture";
          setUploadError(errorMessage);
          setToast({
            message: errorMessage,
            type: "error",
          });
        }
      };

      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        const errorMessage = "Failed to read the image file";
        setUploadError(errorMessage);
        setToast({ message: errorMessage, type: "error" });
      };

      console.log("4a. Starting to read file...");
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("General error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update profile picture";
      setUploadError(errorMessage);
      setToast({
        message: errorMessage,
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
    // Clear any previous upload errors when starting a new upload
    setUploadError(null);

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
      // Clear any upload errors when removing picture
      setUploadError(null);

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

  const checkUsernameAvailability = async (username: string) => {
    if (!username.trim()) {
      setUsernameStatus(null);
      return;
    }

    if (username.trim() === user?.username) {
      setUsernameStatus({ available: true });
      return;
    }

    try {
      setIsCheckingUsername(true);
      const response = await apiFetch(
        `/api/check-username/${encodeURIComponent(username.trim())}`
      );
      setUsernameStatus(response);
    } catch (err) {
      console.error("Failed to check username:", err);
      setUsernameStatus(null);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewUsername(value);

    // Clear any existing timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    // Set a new timeout to check username availability
    checkTimeoutRef.current = setTimeout(() => {
      checkUsernameAvailability(value);
    }, 500); // Wait 500ms after user stops typing
  };

  const handleUsernameEdit = () => {
    setNewUsername(user?.username || "");
    setUsernameStatus({ available: true });
    setIsEditingUsername(true);
    // Focus the input after it's rendered
    setTimeout(() => usernameInputRef.current?.focus(), 0);
  };

  const handleUsernameSave = () => {
    if (!newUsername.trim()) {
      setToast({ message: "Username cannot be empty", type: "error" });
      return;
    }

    if (newUsername.trim() === user?.username) {
      setIsEditingUsername(false);
      return;
    }

    if (!usernameStatus?.available) {
      setToast({
        message: usernameStatus?.reason || "Please choose a different username",
        type: "error",
      });
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleUsernameConfirm = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch("/api/profile/username", {
        method: "PUT",
        body: JSON.stringify({ username: newUsername.trim() }),
      });

      if (response.success && user) {
        updateUser({
          ...user,
          username: newUsername.trim(),
        });
        setToast({ message: "Username updated successfully", type: "success" });
        setIsEditingUsername(false);
        setIsConfirmModalOpen(false);
      }
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to update username",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameCancel = () => {
    setIsEditingUsername(false);
    setNewUsername("");
    setUsernameStatus(null);
    setIsConfirmModalOpen(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);

      const response = await apiFetch("/api/profile/delete", {
        method: "DELETE",
      });

      if (response.success) {
        setToast({
          message: "Account deleted successfully",
          type: "success",
        });

        // Log out user and redirect after a brief delay
        setTimeout(() => {
          logout();
          window.location.href = "/";
        }, 2000);
      } else {
        throw new Error(response.error || "Failed to delete account");
      }
    } catch (err) {
      console.error("Account deletion error:", err);
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to delete account",
        type: "error",
      });
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto dark-scrollbar">
      {/* Header */}
      <Navbar
        subscriptionTier={subscriptionTier}
        isLoadingSubscription={isLoadingSubscription}
      />

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

          {/* Profile Picture Section */}
          <div className="bg-zinc-700/60 border border-zinc-600 rounded-lg p-6 mb-6">
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
                  <div
                    className={`w-24 h-24 rounded-full bg-gradient-to-br ${getGradientBackground(
                      user?.username || user?.email || "user"
                    )} flex items-center justify-center text-white text-2xl font-medium relative`}
                  >
                    <div className="absolute inset-0 opacity-30 mix-blend-overlay">
                      <svg className="w-full h-full rounded-full ">
                        <filter id="noise">
                          <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.65"
                            numOctaves="3"
                            stitchTiles="stitch"
                          />
                          <feColorMatrix type="saturate" values="0" />
                        </filter>
                        <rect width="100%" height="100%" filter="url(#noise)" />
                      </svg>
                    </div>
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
                <p className="text-sm text-zinc-300 mt-2">
                  Max file size: 5MB. Supported formats: JPG, PNG, GIF
                </p>
                {uploadError && (
                  <p className="text-sm text-red-400 mt-2">{uploadError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="bg-zinc-700/60 border border-zinc-600 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Username
                </label>
                {isEditingUsername ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        ref={usernameInputRef}
                        type="text"
                        value={newUsername}
                        onChange={handleUsernameChange}
                        className={`flex-1 bg-zinc-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 ${
                          usernameStatus?.available
                            ? "focus:ring-zinc-300"
                            : usernameStatus?.available === false
                            ? "focus:ring-red-500"
                            : "focus:ring-blue-500"
                        }`}
                        placeholder="Enter new username"
                        disabled={isLoading}
                      />
                      <button
                        onClick={handleUsernameSave}
                        disabled={isLoading || !usernameStatus?.available}
                        className="px-3 py-2 bg-white text-black rounded-lg disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleUsernameCancel}
                        disabled={isLoading}
                        className="px-3 py-2 h-full bg-zinc-700 text-white rounded-lg disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                    {isCheckingUsername ? (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Checking availability...
                      </div>
                    ) : (
                      usernameStatus && (
                        <div
                          className={`text-sm ${
                            usernameStatus.available
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {usernameStatus.available
                            ? "Username is available"
                            : usernameStatus.reason}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-lg">@{user?.username}</p>
                    <button
                      onClick={handleUsernameEdit}
                      className="p-1 text-gray-400 hover:text-white"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Email
                </label>
                <p className="text-lg">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-zinc-700/60 border border-zinc-600 rounded-lg p-6 mb-6">
            <div className="space-y-4">
              <div className="flex flex-col">
                <h3 className="text-xl font-semibold">Delete Account</h3>
                <p className="text-sm text-zinc-300">
                  Remove your account and all associated data. This action is
                  irreversible.
                </p>
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={isLoading || isDeletingAccount}
                className="flex items-center cursor-pointer gap-2 px-4 py-2 border border-red-300/60 text-red-300 hover:bg-red-800 hover:border-red-800 hover:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <FiTrash2 className="w-4 h-4" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      <RemoveProfilePictureModal
        isOpen={isRemoveModalOpen}
        onClose={() => setIsRemoveModalOpen(false)}
        onConfirm={removeProfilePicture}
      />

      <ConfirmUsernameChangeModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleUsernameConfirm}
        newUsername={newUsername.trim()}
        currentUsername={user?.username || ""}
      />

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
        isLoading={isDeletingAccount}
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
