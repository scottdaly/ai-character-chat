import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { Character } from "../types";
import { useAuth } from "./AuthContext";

interface CachedData<T> {
  data: T;
  timestamp: number;
  isLoading: boolean;
  error: Error | null;
}

interface DataContextType {
  // User characters (for Dashboard)
  userCharacters: CachedData<Character[]>;
  loadUserCharacters: () => Promise<void>;
  createUserCharacter: (
    character: Omit<Character, "id" | "userId"> | FormData
  ) => Promise<Character>;

  // Explore characters
  exploreCharacters: CachedData<Character[]>;
  loadExploreCharacters: () => Promise<void>;

  // Cache control
  clearCache: () => void;
  invalidateUserCharacters: () => void;
  isStale: (timestamp: number, maxAge?: number) => boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Cache expiry times (in milliseconds)
const CACHE_EXPIRY = {
  USER_CHARACTERS: 5 * 60 * 1000, // 5 minutes
  EXPLORE_CHARACTERS: 10 * 60 * 1000, // 10 minutes
};

function createEmptyCache<T>(data: T): CachedData<T> {
  return {
    data,
    timestamp: 0,
    isLoading: false,
    error: null,
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { apiFetch, user } = useAuth();

  // User characters cache
  const [userCharacters, setUserCharacters] = useState<CachedData<Character[]>>(
    createEmptyCache([])
  );

  // Explore characters cache
  const [exploreCharacters, setExploreCharacters] = useState<
    CachedData<Character[]>
  >(createEmptyCache([]));

  // Utility function to check if data is stale
  const isStale = useCallback(
    (timestamp: number, maxAge: number = CACHE_EXPIRY.USER_CHARACTERS) => {
      return Date.now() - timestamp > maxAge;
    },
    []
  );

  // Load user characters with caching
  const loadUserCharacters = useCallback(async () => {
    // Use callback form to get fresh state
    let shouldLoad = false;
    setUserCharacters((currentState) => {
      // Check if we have fresh data (either with characters OR a recent successful empty response)
      const hasRecentData =
        currentState.timestamp > 0 &&
        !isStale(currentState.timestamp, CACHE_EXPIRY.USER_CHARACTERS);

      console.log("[DataContext] loadUserCharacters check:", {
        hasRecentData,
        timestamp: currentState.timestamp,
        dataLength: currentState.data.length,
        isLoading: currentState.isLoading,
        error: currentState.error,
      });

      if (hasRecentData) {
        shouldLoad = false;
        return currentState; // No change needed
      }

      shouldLoad = true;
      // Set loading state
      return { ...currentState, isLoading: true, error: null };
    });

    if (!shouldLoad) {
      return;
    }

    try {
      const data = await apiFetch<Character[]>("/api/characters");
      const characters = Array.isArray(data) ? data : [];

      console.log("[DataContext] Received user characters:", {
        count: characters.length,
        characters: characters.map((c) => ({ id: c.id, name: c.name })),
      });

      setUserCharacters({
        data: characters,
        timestamp: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error("Failed to load user characters:", err);
      const error =
        err instanceof Error ? err : new Error("Failed to load characters");

      setUserCharacters((prev) => ({
        ...prev,
        isLoading: false,
        error,
      }));
    }
  }, [apiFetch, isStale]);

  // Load explore characters with caching
  const loadExploreCharacters = useCallback(async () => {
    // Use callback form to get fresh state
    let shouldLoad = false;
    setExploreCharacters((currentState) => {
      // Check if we have fresh data (either with characters OR a recent successful empty response)
      const hasRecentData =
        currentState.timestamp > 0 &&
        !isStale(currentState.timestamp, CACHE_EXPIRY.EXPLORE_CHARACTERS);

      if (hasRecentData) {
        shouldLoad = false;
        return currentState; // No change needed
      }

      shouldLoad = true;
      // Set loading state
      return { ...currentState, isLoading: true, error: null };
    });

    if (!shouldLoad) {
      return;
    }

    try {
      const data = await apiFetch("/api/characters/explore");
      const characters = Array.isArray(data) ? data : [];

      setExploreCharacters({
        data: characters,
        timestamp: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error("Failed to load explore characters:", err);
      const error =
        err instanceof Error
          ? err
          : new Error("Failed to load explore characters");

      setExploreCharacters((prev) => ({
        ...prev,
        isLoading: false,
        error,
      }));
    }
  }, [apiFetch, isStale]);

  // Create user character
  const createUserCharacter = useCallback(
    async (character: Omit<Character, "id" | "userId"> | FormData) => {
      // Set loading state
      setUserCharacters((prev) => ({ ...prev, isLoading: true }));

      try {
        let requestOptions: RequestInit;

        if (character instanceof FormData) {
          requestOptions = {
            method: "POST",
            body: character,
          };
        } else {
          requestOptions = {
            method: "POST",
            body: JSON.stringify(character),
          };
        }

        const newCharacter = await apiFetch<Character>(
          "/api/characters",
          requestOptions
        );

        // Update cache with new character
        setUserCharacters((prev) => ({
          data: [newCharacter, ...prev.data],
          timestamp: Date.now(),
          isLoading: false,
          error: null,
        }));

        return newCharacter;
      } catch (err) {
        console.error("Failed to create character:", err);
        const error =
          err instanceof Error ? err : new Error("Failed to create character");

        setUserCharacters((prev) => ({
          ...prev,
          isLoading: false,
          error,
        }));

        throw err;
      }
    },
    [apiFetch]
  );

  // Clear all cache
  const clearCache = useCallback(() => {
    setUserCharacters(createEmptyCache([]));
    setExploreCharacters(createEmptyCache([]));
  }, []);

  // Invalidate just user characters cache
  const invalidateUserCharacters = useCallback(() => {
    setUserCharacters(createEmptyCache([]));
  }, []);

  // Auto-load user characters when user changes
  useEffect(() => {
    if (user) {
      loadUserCharacters();
    } else {
      // Clear cache when user logs out
      clearCache();
    }
  }, [user, loadUserCharacters, clearCache]);

  const value: DataContextType = {
    userCharacters,
    loadUserCharacters,
    createUserCharacter,
    exploreCharacters,
    loadExploreCharacters,
    clearCache,
    invalidateUserCharacters,
    isStale,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
