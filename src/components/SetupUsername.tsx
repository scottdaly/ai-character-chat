import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function SetupUsername() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [redirectToCharacter, setRedirectToCharacter] = useState<string | null>(
    null
  );
  const { apiFetch, updateUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Get token and redirect parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const redirectCharacter = urlParams.get("redirect_to_character");

    console.log("SetupUsername - URL params:", window.location.search);
    console.log("SetupUsername - token:", token);
    console.log("SetupUsername - redirectCharacter:", redirectCharacter);

    if (token) {
      localStorage.setItem("token", token);
    }

    if (redirectCharacter) {
      setRedirectToCharacter(redirectCharacter);
      console.log(
        "SetupUsername - set redirectToCharacter state:",
        redirectCharacter
      );
    }

    // Clear parameters from URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const handleSubmitWithRetry = async (
    usernameToSubmit: string,
    attempt = 1
  ) => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    try {
      console.log(`Sending username (attempt ${attempt}):`, usernameToSubmit);
      const response = await apiFetch("/api/setup-username", {
        method: "POST",
        body: JSON.stringify({ username: usernameToSubmit }),
      });

      console.log("Response:", response);
      console.log("Response success?", response.success);

      if (response.success === false) {
        throw new Error(response.error || "Failed to set username");
      }

      // Store the new token if one is returned
      if (response.token) {
        localStorage.setItem("token", response.token);
      }

      // Refresh user data to update the context with the new username
      try {
        const updatedUserData = await apiFetch("/api/me");
        updateUser({
          id: updatedUserData.id,
          displayName: updatedUserData.displayName,
          email: updatedUserData.email,
          username: updatedUserData.username,
          isAdmin: updatedUserData.isAdmin,
          profilePicture: updatedUserData.profilePicture,
        });
      } catch (userFetchError) {
        console.error("Failed to refresh user data:", userFetchError);
        // Continue anyway since username was set successfully
      }

      // Reset retry count on success
      setRetryCount(0);
      setIsRetrying(false);

      // Redirect based on whether there's a character to redirect to
      if (redirectToCharacter) {
        const tempId = `temp-${Date.now()}`;
        const characterUrl = `/dashboard/characters/${redirectToCharacter}/conversations/${tempId}`;
        console.log("SetupUsername - redirecting to character:", characterUrl);
        navigate(characterUrl);
      } else {
        console.log("SetupUsername - redirecting to dashboard");
        navigate("/dashboard");
      }

      return true; // Success
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to set username";

      // Check if this is a "User not found" error and we haven't exceeded max retries
      if (errorMessage.includes("User not found") && attempt < maxRetries) {
        console.log(
          `User not found error, retrying in ${
            baseDelay * attempt
          }ms... (attempt ${attempt}/${maxRetries})`
        );

        setRetryCount(attempt);
        setIsRetrying(true);
        setError(
          `Authentication still processing... Retrying (${attempt}/${maxRetries})`
        );

        await delay(baseDelay * attempt); // Progressive delay

        return await handleSubmitWithRetry(usernameToSubmit, attempt + 1);
      } else {
        // Either not a "User not found" error, or we've exceeded max retries
        setRetryCount(0);
        setIsRetrying(false);

        if (errorMessage.includes("User not found")) {
          setError("Authentication failed. Please try signing in again.");

          // After a delay, redirect back to home to try auth again
          setTimeout(() => {
            localStorage.removeItem("token");
            window.location.href = "/";
          }, 3000);
        } else {
          setError(errorMessage);
        }

        return false; // Failed
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setRetryCount(0);
    setIsRetrying(false);

    try {
      await handleSubmitWithRetry(username);
    } catch (err) {
      // This shouldn't happen as handleSubmitWithRetry handles all errors
      console.error("Unexpected error in handleSubmit:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  return (
    <div className="min-h-screen text-gray-100 px-4 flex flex-col items-center">
      <div className="flex flex-row items-center justify-center gap-1 text-3xl instrument-serif-regular py-4">
        <svg
          width="155"
          height="267"
          viewBox="0 0 155 267"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8"
        >
          <path
            d="M142.666 3.46669C132.132 7.73336 119.466 16.9334 101.866 33.0667C76.2658 56.4 68.9324 62.2667 47.0658 76.8C18.2658 96 5.59909 109.867 2.53242 125.6L1.73242 130H8.26576C22.5324 130 35.0658 124.267 69.1991 102C80.7991 94.5334 95.4658 85.7334 101.866 82.4C114.532 76 134.399 69.2 144.932 67.6C151.066 66.8 151.999 66.2667 153.066 62.6667C155.066 56.1334 154.932 15.6 152.799 7.60002C151.866 3.86669 150.666 0.666685 150.266 0.800018C149.732 0.800018 146.399 2.00002 142.666 3.46669Z"
            fill="white"
          />
          <path
            d="M122 85.4667C105.2 89.8667 91.3334 98.8 66.6667 121.067C59.4667 127.467 46.6667 137.733 38.1334 143.867C29.6 150 19.7333 158.133 16.2667 161.867C1.73335 177.333 -3.19999 199.467 2.66668 222.4C3.46668 225.333 4.13335 225.867 6.53335 225.2C21.7333 220.533 35.6 211.867 48.4 199.067C57.7334 189.733 66.2667 177.6 80.5334 153.067C92.1334 133.067 100.667 122.667 112 114.667C123.2 106.667 132.133 103.2 144.667 102.133L154.667 101.333V93.3334C154.667 85.6 154.533 85.3334 150.667 84.5334C143.6 82.9334 129.6 83.4667 122 85.4667Z"
            fill="white"
          />
          <path
            d="M139.467 130.8C129.067 133.6 116.8 140 107.867 147.2C91.2003 160.533 82.2669 175.333 67.4669 214.4C57.0669 241.733 53.8669 247.6 43.4669 257.867L34.9336 266.4L42.2669 265.6C57.0669 264.133 67.6003 255.733 88.6669 228.667C101.334 212.533 112.4 201.067 132.4 183.6C148.667 169.333 153.6 159.6 154.267 139.6L154.667 128.667L150.667 128.8C148.534 128.8 143.467 129.733 139.467 130.8Z"
            fill="white"
          />
        </svg>
        NeverMade
      </div>
      <div className="flex flex-col items-center justify-center w-full py-12">
        <div className="w-full max-w-md p-8 bg-zinc-700/50 rounded-xl border border-zinc-600/50 shadow-lg">
          <h1 className="text-2xl font-bold mb-6 text-center">
            Choose Your Username
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-600/50 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-zinc-400"
                placeholder="Enter your username"
                minLength={3}
                maxLength={30}
                required
                disabled={isLoading}
              />
              <p className="mt-1 text-sm text-zinc-400">
                This will be displayed as your creator name for characters you
                create.
              </p>
            </div>

            {error && (
              <div
                className={`text-sm ${
                  isRetrying ? "text-yellow-500" : "text-red-500"
                }`}
              >
                {error}
                {isRetrying && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-yellow-500"></span>
                    <span className="text-xs">Please wait...</span>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full group/continueButton cursor-pointer bg-gradient-to-br bg-emerald-600/90 hover:bg-emerald-600/80 disabled:bg-emerald-800 disabled:text-zinc-200 disabled:cursor-not-allowed py-2 px-4 rounded-lg transition-colors duration-300 ease-in-out"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
                  {isRetrying
                    ? `Retrying... (${retryCount}/3)`
                    : "Setting username..."}
                </div>
              ) : (
                <span className="group-hover/continueButton:scale-105 transition-all duration-300 ease-in-out">
                  Continue
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
