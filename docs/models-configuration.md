# AI Models Configuration

This document explains the centralized AI models configuration system used throughout the application.

## Overview

Instead of hardcoding model information in multiple places, we now have a centralized configuration that defines all available AI models with their properties. This makes it easier to:

- Add new models
- Update model information
- Maintain consistency across frontend and backend
- Control model availability based on subscription tiers

## Files

### Frontend Configuration

- `src/config/models.ts` - TypeScript configuration for React components
- `src/components/ModelSelector.tsx` - Reusable model selection component

### Backend Configuration

- `ai-chat-api/models.js` - Node.js configuration for server-side validation and routing

## Model Properties

Each model is defined with the following properties:

```typescript
interface AIModel {
  id: string; // Unique identifier used by AI APIs
  displayName: string; // Human-readable name shown in UI
  provider: "OpenAI" | "Google" | "Anthropic";
  tier: "free" | "pro"; // Subscription tier required
  description?: string; // Optional description
  capabilities?: string[]; // Optional capabilities list
}
```

## Usage Examples

### Frontend

#### Using the Model Selector Component

```tsx
import ModelSelector from "../components/ModelSelector";

function MyComponent() {
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini-2024-07-18");

  return (
    <ModelSelector
      value={selectedModel}
      onChange={setSelectedModel}
      userTier={subscriptionTier}
    />
  );
}
```

#### Getting Model Information

```tsx
import {
  getModelDisplayName,
  getModelById,
  isModelAvailable,
} from "../config/models";

// Get display name for a model ID
const displayName = getModelDisplayName("gpt-4o-mini-2024-07-18"); // "GPT-4o Mini"

// Check if model is available for user's tier
const canUse = isModelAvailable("claude-opus-4-20250514", "free"); // false

// Get full model object
const model = getModelById("gpt-4o-mini-2024-07-18");
```

#### Getting Model Groups for Dropdowns

```tsx
import { getModelGroups } from "../config/models";

const modelGroups = getModelGroups(subscriptionTier);
// Returns grouped models organized by provider and tier
```

### Backend

#### Model Validation

```javascript
const { getAllModelIds, isModelAvailable } = require("./models");

// Validate model ID
const allowedModels = getAllModelIds();
if (!allowedModels.includes(modelId)) {
  throw new Error("Invalid model");
}

// Check tier access
if (!isModelAvailable(modelId, userTier)) {
  throw new Error("Model not available for your tier");
}
```

#### Provider Detection for API Routing

```javascript
const { getModelProvider } = require("./models");

const provider = getModelProvider("claude-opus-4-20250514"); // 'anthropic'

if (provider === "anthropic") {
  // Use Anthropic API
} else if (provider === "openai") {
  // Use OpenAI API
} else if (provider === "google") {
  // Use Google AI API
}
```

## Adding New Models

To add a new model:

1. Add the model definition to both `src/config/models.ts` and `ai-chat-api/models.js`
2. Ensure the model ID matches exactly what the AI provider expects
3. Set the correct provider and tier
4. Add a descriptive display name

Example:

```typescript
{
  id: 'gpt-5-turbo',
  displayName: 'GPT-5 Turbo',
  provider: 'OpenAI',
  tier: 'pro',
  description: 'Next-generation GPT model with enhanced capabilities'
}
```

## Migration from Hardcoded Models

The system maintains backward compatibility with legacy model IDs. When migrating existing code:

1. Replace hardcoded model arrays with `getAllModelIds()`
2. Replace manual provider detection with `getModelProvider()`
3. Replace hardcoded display names with `getModelDisplayName()`
4. Use `ModelSelector` component instead of custom dropdowns

## Benefits

- **Single Source of Truth**: All model information is centralized
- **Type Safety**: TypeScript interfaces ensure consistency
- **Easy Maintenance**: Add/update models in one place
- **Automatic UI Updates**: Model selectors automatically reflect changes
- **Tier Management**: Built-in subscription tier handling
- **Provider Abstraction**: Automatic API routing based on model
- **Backward Compatibility**: Legacy model IDs still work

## Best Practices

1. Always use the helper functions instead of hardcoding model information
2. Use the `ModelSelector` component for consistent UI
3. Keep frontend and backend configurations in sync
4. Test model additions with both free and pro tiers
5. Use descriptive display names that users will understand
