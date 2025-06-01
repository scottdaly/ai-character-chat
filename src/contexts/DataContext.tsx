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
    // Check if we have fresh data
    if (
      userCharacters.data.length > 0 &&
      !isStale(userCharacters.timestamp, CACHE_EXPIRY.USER_CHARACTERS)
    ) {
      return;
    }

    // Set loading state
    setUserCharacters((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await apiFetch<Character[]>("/api/characters");
      const characters = Array.isArray(data) ? data : [];

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
  }, [apiFetch, userCharacters.data.length, userCharacters.timestamp, isStale]);

  // Load explore characters with caching
  const loadExploreCharacters = useCallback(async () => {
    // Check if we have fresh data
    if (
      exploreCharacters.data.length > 0 &&
      !isStale(exploreCharacters.timestamp, CACHE_EXPIRY.EXPLORE_CHARACTERS)
    ) {
      return;
    }

    // Set loading state
    setExploreCharacters((prev) => ({ ...prev, isLoading: true, error: null }));

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
  }, [
    apiFetch,
    exploreCharacters.data.length,
    exploreCharacters.timestamp,
    isStale,
  ]);

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
