// src/api/characters.ts
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Character } from "../types";

export const useCharacter = (characterId: string) => {
  const { apiFetch } = useAuth();
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getCharacter = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch<Character>(`/api/characters/${characterId}`);
      setCharacter(data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to load character")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (characterId) {
      getCharacter();
    }
  }, [characterId]);

  return { character, isLoading, error };
};

export const useCharacters = () => {
  const { apiFetch } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getCharacters = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch<Character[]>("/api/characters");
      setCharacters(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load characters:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to load characters")
      );
      setCharacters([]); // Ensure characters is always an array
    } finally {
      setIsLoading(false);
    }
  };

  const createCharacter = async (
    character: Omit<Character, "id" | "userId"> | FormData
  ) => {
    try {
      setIsLoading(true);

      let requestOptions: RequestInit;

      if (character instanceof FormData) {
        // Handle FormData for image uploads
        requestOptions = {
          method: "POST",
          body: character,
          // Don't set Content-Type header for FormData - browser will set it with boundary
        };
      } else {
        // Handle regular JSON data
        requestOptions = {
          method: "POST",
          body: JSON.stringify(character),
        };
      }

      const newCharacter = await apiFetch<Character>(
        "/api/characters",
        requestOptions
      );
      setCharacters((prev) => [...prev, newCharacter]);
      return newCharacter;
    } catch (err) {
      console.error("Failed to create character:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to create character")
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getCharacters();
  }, []);

  return { characters, createCharacter, isLoading, error };
};
