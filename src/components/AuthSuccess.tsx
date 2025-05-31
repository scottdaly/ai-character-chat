// src/components/AuthSuccess.tsx
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AuthSuccess() {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double execution in React development mode
    if (hasProcessed.current) {
      return;
    }

    const authenticateUser = async () => {
      try {
        // Get token and redirect parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        const redirectToCharacter = urlParams.get("redirect_to_character");

        if (!token) {
          throw new Error("No token found");
        }

        // Mark as processed to prevent double execution
        hasProcessed.current = true;

        // Store token
        localStorage.setItem("token", token);

        // Verify token and get user data
        const userData = await apiFetch("/api/me");

        // Clear parameters from URL only after successful processing
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );

        // Redirect based on username status and character redirect
        if (!userData.username) {
          // User needs to set up username first
          if (redirectToCharacter) {
            navigate(
              `/setup-username?redirect_to_character=${redirectToCharacter}`
            );
          } else {
            navigate("/setup-username");
          }
        } else if (redirectToCharacter) {
          // User has username and wants to go to specific character
          const tempId = `temp-${Date.now()}`;
          const characterUrl = `/dashboard/characters/${redirectToCharacter}/conversations/${tempId}`;

          // Use window.location.href to avoid race conditions with React Router
          window.location.href = characterUrl;
        } else {
          // Normal flow to dashboard
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Authentication failed:", error);
        navigate("/");
      }
    };

    authenticateUser();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-300">Completing authentication...</p>
      </div>
    </div>
  );
}
