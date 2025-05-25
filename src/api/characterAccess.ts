import { UserConversationWithCharacter } from "./useUserConversations";

export interface CharacterAccessResult {
  hasAccess: boolean;
  isLocked: boolean;
  reason?: string;
  allowedCharacterIds: string[];
}

export function checkCharacterAccess(
  characterId: string,
  subscriptionTier: string,
  userConversations: UserConversationWithCharacter[],
  userCreatedCharacterIds: string[] = []
): CharacterAccessResult {
  // Pro users always have access
  if (subscriptionTier === "pro") {
    return {
      hasAccess: true,
      isLocked: false,
      allowedCharacterIds: [],
    };
  }

  // For free tier users
  if (subscriptionTier === "free") {
    // Sort conversations by createdAt DESC to match server logic
    const sortedConversations = [...userConversations].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Get unique character IDs from conversations (most recent first)
    const uniqueInteractedCharacterIds = [
      ...new Set(sortedConversations.map((conv) => conv.characterId)),
    ];

    // If user has interacted with fewer than 3 characters, they can interact with more
    if (uniqueInteractedCharacterIds.length < 3) {
      // They can interact with characters they've chatted with OR their own created characters
      const allowedCharacterIds = [
        ...uniqueInteractedCharacterIds,
        ...userCreatedCharacterIds.filter(
          (id) => !uniqueInteractedCharacterIds.includes(id)
        ),
      ].slice(0, 3);

      return {
        hasAccess:
          allowedCharacterIds.includes(characterId) ||
          uniqueInteractedCharacterIds.length < 3,
        isLocked:
          !allowedCharacterIds.includes(characterId) &&
          uniqueInteractedCharacterIds.length >= 3,
        allowedCharacterIds,
      };
    }

    // If user has interacted with 3+ characters, only the most recent 3 are allowed
    const allowedCharacterIds = uniqueInteractedCharacterIds.slice(0, 3);
    const hasAccess = allowedCharacterIds.includes(characterId);

    return {
      hasAccess,
      isLocked: !hasAccess,
      reason: hasAccess
        ? undefined
        : "Upgrade to Pro to chat with this character. You can chat with your 3 most recent characters on the free plan.",
      allowedCharacterIds,
    };
  }

  // Default fallback
  return {
    hasAccess: true,
    isLocked: false,
    allowedCharacterIds: [],
  };
}

export function canCreateNewConversation(
  characterId: string,
  subscriptionTier: string,
  userConversations: UserConversationWithCharacter[]
): { canCreate: boolean; reason?: string } {
  if (subscriptionTier === "pro") {
    return { canCreate: true };
  }

  if (subscriptionTier === "free") {
    const uniqueInteractedCharacterIds = [
      ...new Set(userConversations.map((conv) => conv.characterId)),
    ];

    const currentCharacterIsNewInteraction =
      !uniqueInteractedCharacterIds.includes(characterId);

    if (
      uniqueInteractedCharacterIds.length >= 3 &&
      currentCharacterIsNewInteraction
    ) {
      return {
        canCreate: false,
        reason:
          "Upgrade to Pro to start conversations with new characters. You have reached your limit for the free plan.",
      };
    }

    return { canCreate: true };
  }

  return { canCreate: true };
}
