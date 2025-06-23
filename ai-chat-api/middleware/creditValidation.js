const rateLimit = require("express-rate-limit");
const { body, param, query, validationResult } = require("express-validator");

// Rate limiting configurations
const createCreditRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// Rate limiters for different operations
const creditOperationLimiter = createCreditRateLimit(
  60 * 1000, // 1 minute
  100, // 100 requests per minute per IP
  "Too many credit operations. Please try again later."
);

const messageLimiter = createCreditRateLimit(
  60 * 1000, // 1 minute
  30, // 30 messages per minute per IP
  "Too many messages. Please slow down."
);

const strictCreditLimiter = createCreditRateLimit(
  5 * 60 * 1000, // 5 minutes
  10, // 10 requests per 5 minutes
  "Too many credit-related requests. Please wait before trying again."
);

// Validation rules for credit operations
const creditValidationRules = {
  // Validate message sending (credit deduction)
  validateMessage: [
    body("content")
      .trim()
      .isLength({ min: 1, max: 10000 })
      .withMessage("Message content must be between 1 and 10,000 characters")
      .matches(/^[\s\S]*$/)
      .withMessage("Message contains invalid characters"),

    body("attachments")
      .optional()
      .isArray({ max: 5 })
      .withMessage("Maximum 5 attachments allowed"),

    body("attachments.*.data")
      .optional()
      .matches(/^data:image\/(jpeg|jpg|png|gif|webp);base64,/)
      .withMessage("Invalid image format"),

    body("attachments.*.size")
      .optional()
      .isInt({ min: 1, max: 5 * 1024 * 1024 })
      .withMessage("Image size must be between 1 byte and 5MB"),
  ],

  // Validate credit balance checks
  validateCreditCheck: [
    param("userId").isUUID().withMessage("Invalid user ID format"),

    query("requiredCredits")
      .optional()
      .isFloat({ min: 0, max: 1000 })
      .withMessage("Required credits must be between 0 and 1000"),
  ],

  // Validate credit usage statistics requests
  validateUsageStats: [
    param("userId").isUUID().withMessage("Invalid user ID format"),

    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO 8601 date"),

    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO 8601 date"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage("Limit must be between 1 and 500"),
  ],

  // Validate conversation/message IDs
  validateConversationAccess: [
    param("conversationId")
      .isUUID()
      .withMessage("Invalid conversation ID format"),

    param("messageId")
      .optional()
      .isUUID()
      .withMessage("Invalid message ID format"),
  ],

  // Validate credit compensation requests
  validateCompensation: [
    body("userId").isUUID().withMessage("Invalid user ID format"),

    body("creditsToRefund")
      .isFloat({ min: 0.0001, max: 1000 })
      .withMessage("Credits to refund must be between 0.0001 and 1000"),

    body("reason")
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage("Reason must be between 10 and 500 characters"),

    body("messageId")
      .optional()
      .isUUID()
      .withMessage("Invalid message ID format"),
  ],
};

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }));

    console.warn("Validation failed:", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      errors: errorMessages,
      body: req.body,
      params: req.params,
      query: req.query,
    });

    return res.status(400).json({
      error: "Validation failed",
      details: errorMessages,
    });
  }

  next();
};

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize request body
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// Recursive object sanitization
const sanitizeObject = (obj) => {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip potentially dangerous keys
    if (
      key.startsWith("__") ||
      key.includes("prototype") ||
      key.includes("constructor")
    ) {
      continue;
    }

    // Sanitize string values
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

// String sanitization
const sanitizeString = (str) => {
  if (typeof str !== "string") {
    return str;
  }

  // Remove null bytes and control characters (except tabs, newlines, carriage returns)
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Add security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Add custom security headers for credit operations
  res.setHeader("X-Credit-Operation-Time", Date.now().toString());
  res.setHeader(
    "X-Request-ID",
    req.headers["x-request-id"] || require("crypto").randomUUID()
  );

  next();
};

// Request logging middleware for security monitoring
const securityLogger = (req, res, next) => {
  const requestData = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    hasAuth: !!req.headers.authorization,
  };

  // Log suspicious patterns
  const suspiciousPatterns = [
    /\b(union|select|insert|update|delete|drop|create|alter|exec|script)\b/i,
    /[<>'"]/,
    /__proto__|constructor|prototype/i,
    /\$\{|\$\(/,
    /javascript:|data:text\/html/i,
  ];

  const requestString =
    JSON.stringify(req.body) + JSON.stringify(req.query) + req.originalUrl;
  const isSuspicious = suspiciousPatterns.some((pattern) =>
    pattern.test(requestString)
  );

  if (isSuspicious) {
    console.warn("Suspicious request detected:", {
      ...requestData,
      body: req.body,
      query: req.query,
      suspiciousContent: requestString,
    });
  }

  // Log all credit-related operations
  if (
    req.originalUrl.includes("/credit") ||
    req.originalUrl.includes("/messages")
  ) {
    console.log("Credit operation request:", requestData);
  }

  next();
};

// Credit operation context middleware
const addCreditContext = (req, res, next) => {
  // Add context for credit operations
  req.creditContext = {
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date(),
    requestId: req.headers["x-request-id"] || require("crypto").randomUUID(),
    userTier: req.user?.subscriptionTier || "free",
  };

  next();
};

// Export all middleware and validation rules
module.exports = {
  // Rate limiters
  creditOperationLimiter,
  messageLimiter,
  strictCreditLimiter,

  // Validation rules
  creditValidationRules,
  handleValidationErrors,

  // Security middleware
  sanitizeInput,
  securityHeaders,
  securityLogger,
  addCreditContext,

  // Helper functions
  sanitizeObject,
  sanitizeString,
};
