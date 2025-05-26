// AI Models Configuration for Backend
const AI_MODELS = [
  // OpenAI Free Models
  {
    id: "gpt-4o-mini-2024-07-18",
    displayName: "GPT-4o Mini",
    provider: "OpenAI",
    tier: "free",
    description: "Fast and efficient model for everyday tasks",
    inputTypes: ["text", "images"],
  },
  {
    id: "gpt-4.1-nano-2025-04-14",
    displayName: "GPT-4.1 Nano",
    provider: "OpenAI",
    tier: "free",
    description: "Compact version of GPT-4.1",
    inputTypes: ["text"],
  },

  // Google Free Models
  {
    id: "gemini-2.0-flash-lite",
    displayName: "Gemini 2.0 Flash Lite",
    provider: "Google",
    tier: "free",
    description: "Lightweight version of Gemini 2.0",
    inputTypes: ["text", "images"],
  },
  {
    id: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    provider: "Google",
    tier: "free",
    description: "Fast and capable multimodal model",
    inputTypes: ["text", "images"],
  },

  // OpenAI Pro Models
  {
    id: "gpt-4o-2024-08-06",
    displayName: "GPT-4o",
    provider: "OpenAI",
    tier: "pro",
    description: "Advanced reasoning and multimodal capabilities",
    inputTypes: ["text", "images"],
  },
  {
    id: "chatgpt-4o-latest",
    displayName: "GPT-4o Latest",
    provider: "OpenAI",
    tier: "pro",
    description: "Latest version of GPT-4o with improvements",
    inputTypes: ["text", "images"],
  },
  {
    id: "gpt-4.1-2025-04-14",
    displayName: "GPT-4.1",
    provider: "OpenAI",
    tier: "pro",
    description: "Enhanced version of GPT-4 with better reasoning",
    inputTypes: ["text", "images"],
  },
  {
    id: "o4-mini-2025-04-16",
    displayName: "o4 Mini",
    provider: "OpenAI",
    tier: "pro",
    description: "Compact but powerful reasoning model",
    inputTypes: ["text", "images"],
  },

  // Google Pro Models
  {
    id: "gemini-2.5-flash-preview-05-20",
    displayName: "Gemini 2.5 Flash",
    provider: "Google",
    tier: "pro",
    description: "Next-generation Gemini with enhanced capabilities",
    inputTypes: ["text", "images"],
  },
  {
    id: "gemini-2.5-pro-preview-05-06",
    displayName: "Gemini 2.5 Pro",
    provider: "Google",
    tier: "pro",
    description: "Most capable Gemini model for complex tasks",
    inputTypes: ["text", "images"],
  },

  // Anthropic Pro Models
  {
    id: "claude-opus-4-20250514",
    displayName: "Claude 4 Opus",
    provider: "Anthropic",
    tier: "pro",
    description: "Most capable Claude model for complex reasoning",
    inputTypes: ["text", "images"],
  },
  {
    id: "claude-sonnet-4-20250514",
    displayName: "Claude 4 Sonnet",
    provider: "Anthropic",
    tier: "pro",
    description: "Balanced performance and capability",
    inputTypes: ["text", "images"],
  },
  {
    id: "claude-3-7-sonnet-latest",
    displayName: "Claude 3.7 Sonnet",
    provider: "Anthropic",
    tier: "pro",
    description: "Enhanced Claude 3.5 with improved reasoning",
    inputTypes: ["text", "images"],
  },
  {
    id: "claude-3-5-haiku-latest",
    displayName: "Claude 3.5 Haiku",
    provider: "Anthropic",
    tier: "pro",
    description: "Fast and efficient Claude model",
    inputTypes: ["text", "images"],
  },

  // Legacy models for backward compatibility
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o Mini (Legacy)",
    provider: "OpenAI",
    tier: "free",
    description: "Legacy version of GPT-4o Mini",
    inputTypes: ["text", "images"],
  },
  {
    id: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet (Legacy)",
    provider: "Anthropic",
    tier: "pro",
    description: "Legacy version of Claude 3.5 Sonnet",
    inputTypes: ["text", "images"],
  },
  {
    id: "claude-3-5-haiku-20241022",
    displayName: "Claude 3.5 Haiku (Legacy)",
    provider: "Anthropic",
    tier: "pro",
    description: "Legacy version of Claude 3.5 Haiku",
    inputTypes: ["text", "images"],
  },
  {
    id: "claude-3-haiku-20240307",
    displayName: "Claude 3 Haiku (Legacy)",
    provider: "Anthropic",
    tier: "pro",
    description: "Legacy Claude 3 Haiku model",
    inputTypes: ["text", "images"],
  },
  {
    id: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash (Legacy)",
    provider: "Google",
    tier: "pro",
    description: "Legacy Gemini 1.5 Flash model",
    inputTypes: ["text", "images"],
  },
  {
    id: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro (Legacy)",
    provider: "Google",
    tier: "pro",
    description: "Legacy Gemini 1.5 Pro model",
    inputTypes: ["text", "images"],
  },
  {
    id: "gemini-1.0-pro",
    displayName: "Gemini 1.0 Pro (Legacy)",
    provider: "Google",
    tier: "pro",
    description: "Legacy Gemini 1.0 Pro model",
    inputTypes: ["text"],
  },
  {
    id: "gpt-3.5-turbo",
    displayName: "GPT-3.5 Turbo (Legacy)",
    provider: "OpenAI",
    tier: "free",
    description: "Legacy GPT-3.5 Turbo model",
    inputTypes: ["text"],
  },
];

// Helper functions
const getModelById = (id) => {
  return AI_MODELS.find((model) => model.id === id);
};

const getModelDisplayName = (id) => {
  const model = getModelById(id);
  return model?.displayName || id;
};

const getModelsByTier = (tier) => {
  return AI_MODELS.filter((model) => model.tier === tier);
};

const getModelsByProvider = (provider) => {
  return AI_MODELS.filter((model) => model.provider === provider);
};

const isModelAvailable = (modelId, userTier) => {
  const model = getModelById(modelId);
  if (!model) return false;
  return userTier === "pro" || model.tier === "free";
};

const getDefaultModel = (userTier = "free") => {
  const freeModels = getModelsByTier("free");
  return (
    freeModels.find((m) => m.id === "gpt-4o-mini-2024-07-18")?.id ||
    freeModels[0]?.id ||
    "gpt-4o-mini"
  );
};

// Provider detection for API routing
const getModelProvider = (modelId) => {
  const model = getModelById(modelId);
  if (!model) {
    // Fallback detection for legacy models
    if (modelId.startsWith("claude-")) return "anthropic";
    if (modelId.startsWith("gemini-")) return "google";
    if (
      modelId.startsWith("gpt-") ||
      modelId.startsWith("chatgpt-") ||
      modelId.startsWith("o4-")
    )
      return "openai";
    return "unknown";
  }

  switch (model.provider) {
    case "OpenAI":
      return "openai";
    case "Anthropic":
      return "anthropic";
    case "Google":
      return "google";
    default:
      return "unknown";
  }
};

// Get all valid model IDs for validation
const getAllModelIds = () => {
  return AI_MODELS.map((model) => model.id);
};

// Check if a model supports image inputs
const supportsImages = (modelId) => {
  const model = getModelById(modelId);
  return model?.inputTypes?.includes("images") || false;
};

module.exports = {
  AI_MODELS,
  getModelById,
  getModelDisplayName,
  getModelsByTier,
  getModelsByProvider,
  isModelAvailable,
  getDefaultModel,
  getModelProvider,
  getAllModelIds,
  supportsImages,
};
