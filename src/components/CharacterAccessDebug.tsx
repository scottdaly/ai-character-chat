import { useAuth } from "../contexts/AuthContext";
import { useUserConversations } from "../api/useUserConversations";
import { useCharacters } from "../api/characters";
import { checkCharacterAccess } from "../api/characterAccess";

export default function CharacterAccessDebug() {
  const { user, subscriptionTier } = useAuth();
  const {
    conversations: userConversations,
    isLoading: isLoadingConversations,
  } = useUserConversations();
  const { characters, isLoading: isLoadingCharacters } = useCharacters();

  if (isLoadingConversations || isLoadingCharacters) {
    return <div>Loading...</div>;
  }

  const userCreatedCharacterIds = characters
    .filter((char) => char.UserId?.toString() === user?.id)
    .map((char) => String(char.id));

  return (
    <div className="p-6 bg-zinc-900 text-white">
      <h2 className="text-2xl font-bold mb-4">Character Access Debug</h2>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">User Info</h3>
        <p>User ID: {user?.id}</p>
        <p>Subscription Tier: {subscriptionTier}</p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">User Conversations</h3>
        <p>Total conversations: {userConversations.length}</p>
        <div className="space-y-2">
          {userConversations.map((conv) => (
            <div key={conv.id} className="bg-zinc-800 p-2 rounded">
              <p>Character ID: {conv.CharacterId}</p>
              <p>Character Name: {conv.Character?.name}</p>
              <p>Created: {new Date(conv.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Character Access Results</h3>
        {characters.map((character) => {
          const characterId = String(character.id);
          const accessResult = checkCharacterAccess(
            characterId,
            subscriptionTier,
            userConversations,
            userCreatedCharacterIds
          );

          return (
            <div key={character.id} className="bg-zinc-800 p-4 rounded mb-2">
              <h4 className="font-semibold">{character.name}</h4>
              <p>Character ID: {characterId}</p>
              <p>Has Access: {accessResult.hasAccess ? "✅" : "❌"}</p>
              <p>Is Locked: {accessResult.isLocked ? "🔒" : "🔓"}</p>
              {accessResult.reason && <p>Reason: {accessResult.reason}</p>}
              <p>
                User Created:{" "}
                {userCreatedCharacterIds.includes(characterId) ? "Yes" : "No"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
