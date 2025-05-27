export interface AIModel {
  id: string;
  displayName: string;
  provider: "OpenAI" | "Google" | "Anthropic";
  tier: "free" | "pro";
  description?: string;
  inputTypes?: string[];
}

export interface ModelGroup {
  label: string;
  models: AIModel[];
}

export const AI_MODELS: AIModel[] = [
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
    id: "chatgpt-4o-latest",
    displayName: "GPT-4o Latest",
    provider: "OpenAI",
    tier: "pro",
    description: "Standard model for ChatGPT",
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
];

// Helper functions
export const getModelById = (id: string): AIModel | undefined => {
  return AI_MODELS.find((model) => model.id === id);
};

export const getModelDisplayName = (id: string): string => {
  const model = getModelById(id);
  return model?.displayName || id;
};

export const getModelsByTier = (tier: "free" | "pro"): AIModel[] => {
  return AI_MODELS.filter((model) => model.tier === tier);
};

export const getModelsByProvider = (
  provider: "OpenAI" | "Google" | "Anthropic"
): AIModel[] => {
  return AI_MODELS.filter((model) => model.provider === provider);
};

export const getModelGroups = (
  userTier: "free" | "pro" = "free"
): ModelGroup[] => {
  const freeModels = getModelsByTier("free").filter(
    (model) => !model.displayName.includes("Legacy")
  );
  const proModels =
    userTier === "pro"
      ? getModelsByTier("pro").filter(
          (model) => !model.displayName.includes("Legacy")
        )
      : [];

  const groups: ModelGroup[] = [];

  // Free tier groups
  const freeOpenAI = freeModels.filter((m) => m.provider === "OpenAI");
  const freeGoogle = freeModels.filter((m) => m.provider === "Google");

  if (freeOpenAI.length > 0) {
    groups.push({ label: "OpenAI (Free)", models: freeOpenAI });
  }
  if (freeGoogle.length > 0) {
    groups.push({ label: "Google (Free)", models: freeGoogle });
  }

  // Pro tier groups
  if (userTier === "pro") {
    const proOpenAI = proModels.filter((m) => m.provider === "OpenAI");
    const proGoogle = proModels.filter((m) => m.provider === "Google");
    const proAnthropic = proModels.filter((m) => m.provider === "Anthropic");

    if (proOpenAI.length > 0) {
      groups.push({ label: "OpenAI (Pro)", models: proOpenAI });
    }
    if (proGoogle.length > 0) {
      groups.push({ label: "Google (Pro)", models: proGoogle });
    }
    if (proAnthropic.length > 0) {
      groups.push({ label: "Anthropic (Pro)", models: proAnthropic });
    }
  } else {
    // Show disabled pro options for free users
    groups.push({
      label: "Upgrade to Pro for more models",
      models: [
        {
          id: "pro-placeholder-1",
          displayName: "GPT-4o (Pro)",
          provider: "OpenAI",
          tier: "pro",
        },
        {
          id: "pro-placeholder-2",
          displayName: "GPT-4o Latest (Pro)",
          provider: "OpenAI",
          tier: "pro",
        },
        {
          id: "pro-placeholder-3",
          displayName: "Gemini 2.5 Pro (Pro)",
          provider: "Google",
          tier: "pro",
        },
        {
          id: "pro-placeholder-4",
          displayName: "Gemini 2.5 Flash (Pro)",
          provider: "Google",
          tier: "pro",
        },
        {
          id: "pro-placeholder-5",
          displayName: "Claude 4 Opus (Pro)",
          provider: "Anthropic",
          tier: "pro",
        },
        {
          id: "pro-placeholder-6",
          displayName: "Claude 4 Sonnet (Pro)",
          provider: "Anthropic",
          tier: "pro",
        },
        {
          id: "pro-placeholder-7",
          displayName: "Claude 3.7 Sonnet (Pro)",
          provider: "Anthropic",
          tier: "pro",
        },
        {
          id: "pro-placeholder-8",
          displayName: "Claude 3.5 Haiku (Pro)",
          provider: "Anthropic",
          tier: "pro",
        },
      ],
    });
  }

  return groups;
};

export const isModelAvailable = (
  modelId: string,
  userTier: "free" | "pro"
): boolean => {
  const model = getModelById(modelId);
  if (!model) return false;
  return userTier === "pro" || model.tier === "free";
};

export const getDefaultModel = (_userTier: "free" | "pro" = "free"): string => {
  const freeModels = getModelsByTier("free");
  return (
    freeModels.find((m) => m.id === "gpt-4o-mini-2024-07-18")?.id ||
    freeModels[0]?.id ||
    "gpt-4o-mini"
  );
};

// Provider detection for API routing
export const getModelProvider = (
  modelId: string
): "openai" | "anthropic" | "google" | "unknown" => {
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

// Check if a model supports image inputs
export const supportsImages = (modelId: string): boolean => {
  const model = getModelById(modelId);
  return model?.inputTypes?.includes("images") || false;
};
