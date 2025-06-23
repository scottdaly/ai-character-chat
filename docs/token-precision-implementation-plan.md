# Token Precision & Admin Analytics Implementation Plan

## Overview

This plan outlines the implementation of precise token counting using provider-specific tokenizers and comprehensive admin analytics for monitoring user credit usage.

## Current State

- **Token Estimation**: Simple 4 characters per token ratio
- **Usage Tracking**: Token usage recorded after API responses
- **Admin Tools**: Basic compensation processing endpoint only

## Proposed Implementation

### Phase 1: Tokenizer Integration (Week 1)

#### 1.1 Install Tokenizer Libraries

```bash
# Backend dependencies
npm install tiktoken  # OpenAI tokenizer
npm install @anthropic-ai/tokenizer  # Anthropic tokenizer
npm install @google/generative-ai-tokenizer  # Google tokenizer (if available)
```

#### 1.2 Create Tokenizer Service

```javascript
// ai-chat-api/services/tokenizerService.js
const { encoding_for_model } = require('tiktoken');
const { AnthropicTokenizer } = require('@anthropic-ai/tokenizer');

class TokenizerService {
  constructor() {
    this.tokenizers = new Map();
    this.initializeTokenizers();
  }

  async initializeTokenizers() {
    // OpenAI tokenizers
    this.tokenizers.set('gpt-4', encoding_for_model('gpt-4'));
    this.tokenizers.set('gpt-4o', encoding_for_model('gpt-4'));
    this.tokenizers.set('gpt-4o-mini', encoding_for_model('gpt-3.5-turbo'));
    this.tokenizers.set('gpt-3.5-turbo', encoding_for_model('gpt-3.5-turbo'));
    
    // Anthropic tokenizer
    const anthropicTokenizer = new AnthropicTokenizer();
    this.tokenizers.set('claude-3-5-sonnet-20241022', anthropicTokenizer);
    this.tokenizers.set('claude-3-5-haiku-20241022', anthropicTokenizer);
    this.tokenizers.set('claude-3-opus-20240229', anthropicTokenizer);
    
    // Google tokenizers (when available)
    // this.tokenizers.set('gemini-1.5-pro', new GoogleTokenizer());
  }

  /**
   * Count tokens for a message
   * @param {string} content - Message content
   * @param {string} model - Model name
   * @param {Object} options - Additional options (system prompt, attachments)
   * @returns {Object} Token counts
   */
  async countTokens(content, model, options = {}) {
    const provider = this.getProvider(model);
    
    switch (provider) {
      case 'openai':
        return this.countOpenAITokens(content, model, options);
      case 'anthropic':
        return this.countAnthropicTokens(content, model, options);
      case 'google':
        return this.countGoogleTokens(content, model, options);
      default:
        return this.estimateTokens(content, options);
    }
  }

  countOpenAITokens(content, model, options) {
    const encoder = this.tokenizers.get(model);
    if (!encoder) {
      return this.estimateTokens(content, options);
    }

    let totalTokens = 0;

    // Count system prompt tokens
    if (options.systemPrompt) {
      totalTokens += encoder.encode(options.systemPrompt).length;
      totalTokens += 4; // OpenAI message overhead
    }

    // Count conversation history
    if (options.conversationHistory) {
      for (const msg of options.conversationHistory) {
        totalTokens += encoder.encode(msg.content).length;
        totalTokens += 4; // Message overhead
        
        // Handle image attachments
        if (msg.attachments && msg.attachments.length > 0) {
          totalTokens += msg.attachments.length * 85; // Base64 image token estimate
        }
      }
    }

    // Count current message
    totalTokens += encoder.encode(content).length;
    totalTokens += 4; // Message overhead

    // Add attachment tokens
    if (options.attachments && options.attachments.length > 0) {
      totalTokens += options.attachments.length * 85;
    }

    // Add response priming
    totalTokens += 3; // Response start tokens

    return {
      inputTokens: totalTokens,
      estimatedOutputTokens: Math.min(totalTokens * 0.5, 1000),
      isExact: true,
      method: 'tiktoken'
    };
  }

  countAnthropicTokens(content, model, options) {
    const tokenizer = this.tokenizers.get(model);
    if (!tokenizer) {
      return this.estimateTokens(content, options);
    }

    let inputTokens = 0;

    // Count system prompt
    if (options.systemPrompt) {
      inputTokens += tokenizer.countTokens(options.systemPrompt);
    }

    // Count conversation history
    if (options.conversationHistory) {
      for (const msg of options.conversationHistory) {
        inputTokens += tokenizer.countTokens(msg.content);
        
        // Handle image attachments (Anthropic specific)
        if (msg.attachments && msg.attachments.length > 0) {
          for (const attachment of msg.attachments) {
            // Anthropic charges based on image dimensions
            inputTokens += this.estimateImageTokens(attachment);
          }
        }
      }
    }

    // Count current message
    inputTokens += tokenizer.countTokens(content);

    // Add current message attachments
    if (options.attachments && options.attachments.length > 0) {
      for (const attachment of options.attachments) {
        inputTokens += this.estimateImageTokens(attachment);
      }
    }

    return {
      inputTokens,
      estimatedOutputTokens: Math.min(inputTokens * 0.5, 1000),
      isExact: true,
      method: 'anthropic-tokenizer'
    };
  }

  countGoogleTokens(content, model, options) {
    // For now, use estimation until Google provides a tokenizer
    return this.estimateTokens(content, options);
  }

  estimateTokens(content, options) {
    let totalChars = content.length;

    if (options.systemPrompt) {
      totalChars += options.systemPrompt.length;
    }

    if (options.conversationHistory) {
      for (const msg of options.conversationHistory) {
        totalChars += msg.content.length;
      }
    }

    const estimatedTokens = Math.ceil(totalChars / 4);
    const attachmentTokens = (options.attachments?.length || 0) * 85;

    return {
      inputTokens: estimatedTokens + attachmentTokens,
      estimatedOutputTokens: Math.min(estimatedTokens * 0.5, 1000),
      isExact: false,
      method: 'estimation'
    };
  }

  estimateImageTokens(attachment) {
    // Anthropic's image token calculation
    // Tokens = (width * height) / 750
    // Default to 1024x1024 if dimensions unknown
    const width = attachment.width || 1024;
    const height = attachment.height || 1024;
    return Math.ceil((width * height) / 750);
  }

  getProvider(model) {
    if (model.includes('gpt')) return 'openai';
    if (model.includes('claude')) return 'anthropic';
    if (model.includes('gemini')) return 'google';
    return 'unknown';
  }
}

module.exports = TokenizerService;
```

#### 1.3 Update Credit Service Integration

```javascript
// Update ai-chat-api/services/creditService.js
class CreditService {
  constructor(sequelize, models, tokenizerService) {
    this.sequelize = sequelize;
    this.models = models;
    this.tokenizerService = tokenizerService;
    // ... existing code
  }

  /**
   * Estimate credits needed for a message
   * @param {string} content - Message content
   * @param {string} model - Model name
   * @param {string} provider - Provider name
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Credit estimation
   */
  async estimateMessageCredits(content, model, provider, context = {}) {
    // Get precise token count
    const tokenCount = await this.tokenizerService.countTokens(
      content,
      model,
      {
        systemPrompt: context.systemPrompt,
        conversationHistory: context.conversationHistory,
        attachments: context.attachments
      }
    );

    // Get pricing
    const pricing = await this.getModelPricing(model, provider);

    // Calculate costs
    const inputCost = (tokenCount.inputTokens / 1000) * pricing.inputPricePer1k;
    const outputCost = (tokenCount.estimatedOutputTokens / 1000) * pricing.outputPricePer1k;
    const totalCost = inputCost + outputCost;
    const creditsNeeded = totalCost / 0.001;

    return {
      inputTokens: tokenCount.inputTokens,
      estimatedOutputTokens: tokenCount.estimatedOutputTokens,
      inputCostUsd: inputCost,
      outputCostUsd: outputCost,
      totalCostUsd: totalCost,
      creditsNeeded,
      isExact: tokenCount.isExact,
      tokenCountMethod: tokenCount.method
    };
  }
}
```

### Phase 2: Admin Analytics API (Week 1-2)

#### 2.1 Analytics Database Queries

```javascript
// ai-chat-api/services/analyticsService.js
class AnalyticsService {
  constructor(sequelize, models) {
    this.sequelize = sequelize;
    this.models = models;
  }

  /**
   * Get usage statistics for all users
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Usage statistics
   */
  async getUserUsageStats(filters = {}) {
    const { startDate, endDate, limit = 50, offset = 0, orderBy = 'totalCreditsUsed' } = filters;

    const whereClause = {};
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = startDate;
      if (endDate) whereClause.createdAt[Op.lte] = endDate;
    }

    // Get aggregated user statistics
    const userStats = await this.models.TokenUsage.findAll({
      attributes: [
        'userId',
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'messageCount'],
        [this.sequelize.fn('SUM', this.sequelize.col('totalTokens')), 'totalTokens'],
        [this.sequelize.fn('SUM', this.sequelize.col('inputTokens')), 'totalInputTokens'],
        [this.sequelize.fn('SUM', this.sequelize.col('outputTokens')), 'totalOutputTokens'],
        [this.sequelize.fn('SUM', this.sequelize.col('totalCostUsd')), 'totalCostUsd'],
        [this.sequelize.fn('SUM', this.sequelize.col('creditsUsed')), 'totalCreditsUsed'],
        [this.sequelize.fn('AVG', this.sequelize.col('creditsUsed')), 'avgCreditsPerMessage'],
      ],
      where: whereClause,
      group: ['userId'],
      order: [[this.sequelize.literal(orderBy), 'DESC']],
      limit,
      offset,
      include: [{
        model: this.models.User,
        attributes: ['username', 'email', 'subscriptionTier', 'creditBalance']
      }]
    });

    // Get total count for pagination
    const totalUsers = await this.models.User.count();

    return {
      users: userStats,
      pagination: {
        total: totalUsers,
        limit,
        offset,
        pages: Math.ceil(totalUsers / limit)
      }
    };
  }

  /**
   * Get detailed usage for a specific user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Detailed usage data
   */
  async getUserDetailedUsage(userId, options = {}) {
    const { startDate, endDate, groupBy = 'day' } = options;

    // Base query
    const whereClause = { userId };
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = startDate;
      if (endDate) whereClause.createdAt[Op.lte] = endDate;
    }

    // Get usage grouped by time period
    const groupByClause = this.getGroupByClause(groupBy);
    
    const usageOverTime = await this.models.TokenUsage.findAll({
      attributes: [
        [this.sequelize.fn('DATE_TRUNC', groupBy, this.sequelize.col('createdAt')), 'period'],
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'messageCount'],
        [this.sequelize.fn('SUM', this.sequelize.col('totalTokens')), 'totalTokens'],
        [this.sequelize.fn('SUM', this.sequelize.col('creditsUsed')), 'creditsUsed'],
        [this.sequelize.fn('SUM', this.sequelize.col('totalCostUsd')), 'costUsd'],
      ],
      where: whereClause,
      group: ['period'],
      order: [['period', 'ASC']]
    });

    // Get usage by model
    const usageByModel = await this.models.TokenUsage.findAll({
      attributes: [
        'modelProvider',
        'modelName',
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'messageCount'],
        [this.sequelize.fn('SUM', this.sequelize.col('totalTokens')), 'totalTokens'],
        [this.sequelize.fn('SUM', this.sequelize.col('creditsUsed')), 'creditsUsed'],
      ],
      where: whereClause,
      group: ['modelProvider', 'modelName'],
      order: [[this.sequelize.literal('creditsUsed'), 'DESC']]
    });

    // Get recent messages with token counts
    const recentMessages = await this.models.TokenUsage.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: 100,
      include: [{
        model: this.models.Message,
        attributes: ['content', 'role']
      }, {
        model: this.models.Conversation,
        attributes: ['title']
      }]
    });

    // Get credit history
    const creditHistory = await this.models.CreditAuditLog.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    return {
      user: await this.models.User.findByPk(userId, {
        attributes: ['username', 'email', 'subscriptionTier', 'creditBalance', 'createdAt']
      }),
      summary: {
        totalMessages: recentMessages.length,
        totalCreditsUsed: usageByModel.reduce((sum, m) => sum + parseFloat(m.creditsUsed), 0),
        averageCreditsPerMessage: usageByModel.reduce((sum, m) => sum + parseFloat(m.creditsUsed), 0) / recentMessages.length
      },
      usageOverTime,
      usageByModel,
      recentMessages: recentMessages.slice(0, 20),
      creditHistory: creditHistory.slice(0, 20)
    };
  }

  /**
   * Get system-wide analytics
   * @param {Object} options - Query options
   * @returns {Promise<Object>} System analytics
   */
  async getSystemAnalytics(options = {}) {
    const { startDate, endDate } = options;

    const whereClause = {};
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = startDate;
      if (endDate) whereClause.createdAt[Op.lte] = endDate;
    }

    // Get overall statistics
    const overallStats = await this.models.TokenUsage.findOne({
      attributes: [
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'totalMessages'],
        [this.sequelize.fn('SUM', this.sequelize.col('totalTokens')), 'totalTokens'],
        [this.sequelize.fn('SUM', this.sequelize.col('totalCostUsd')), 'totalCostUsd'],
        [this.sequelize.fn('SUM', this.sequelize.col('creditsUsed')), 'totalCreditsUsed'],
        [this.sequelize.fn('COUNT', this.sequelize.fn('DISTINCT', this.sequelize.col('userId'))), 'activeUsers'],
      ],
      where: whereClause
    });

    // Get usage by provider
    const usageByProvider = await this.models.TokenUsage.findAll({
      attributes: [
        'modelProvider',
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'messageCount'],
        [this.sequelize.fn('SUM', this.sequelize.col('totalTokens')), 'totalTokens'],
        [this.sequelize.fn('SUM', this.sequelize.col('totalCostUsd')), 'totalCostUsd'],
        [this.sequelize.fn('SUM', this.sequelize.col('creditsUsed')), 'creditsUsed'],
      ],
      where: whereClause,
      group: ['modelProvider']
    });

    // Get top models by usage
    const topModels = await this.models.TokenUsage.findAll({
      attributes: [
        'modelName',
        'modelProvider',
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'messageCount'],
        [this.sequelize.fn('SUM', this.sequelize.col('creditsUsed')), 'creditsUsed'],
      ],
      where: whereClause,
      group: ['modelName', 'modelProvider'],
      order: [[this.sequelize.literal('creditsUsed'), 'DESC']],
      limit: 10
    });

    // Get credit balance distribution
    const balanceDistribution = await this.models.User.findAll({
      attributes: [
        [this.sequelize.literal("CASE 
          WHEN creditBalance = 0 THEN '0'
          WHEN creditBalance < 10 THEN '1-10'
          WHEN creditBalance < 100 THEN '10-100'
          WHEN creditBalance < 1000 THEN '100-1000'
          WHEN creditBalance < 10000 THEN '1000-10000'
          ELSE '10000+'
        END"), 'range'],
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'userCount']
      ],
      group: ['range']
    });

    return {
      overall: overallStats,
      byProvider: usageByProvider,
      topModels,
      balanceDistribution,
      generated: new Date()
    };
  }

  getGroupByClause(groupBy) {
    switch (groupBy) {
      case 'hour': return 'hour';
      case 'day': return 'day';
      case 'week': return 'week';
      case 'month': return 'month';
      default: return 'day';
    }
  }
}

module.exports = AnalyticsService;
```

#### 2.2 Admin API Endpoints

```javascript
// Add to ai-chat-api/server.js

// Admin Analytics Routes
app.get(
  "/api/admin/analytics/users",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { startDate, endDate, limit, offset, orderBy } = req.query;
      
      const stats = await analyticsService.getUserUsageStats({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
        orderBy: orderBy || 'totalCreditsUsed'
      });

      res.json(stats);
    } catch (error) {
      console.error("Failed to get user analytics:", error);
      res.status(500).json({ error: "Failed to get analytics data" });
    }
  }
);

app.get(
  "/api/admin/analytics/users/:userId",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { startDate, endDate, groupBy } = req.query;
      
      const details = await analyticsService.getUserDetailedUsage(
        req.params.userId,
        {
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          groupBy: groupBy || 'day'
        }
      );

      res.json(details);
    } catch (error) {
      console.error("Failed to get user details:", error);
      res.status(500).json({ error: "Failed to get user details" });
    }
  }
);

app.get(
  "/api/admin/analytics/system",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const analytics = await analyticsService.getSystemAnalytics({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });

      res.json(analytics);
    } catch (error) {
      console.error("Failed to get system analytics:", error);
      res.status(500).json({ error: "Failed to get system analytics" });
    }
  }
);

// Export analytics data
app.get(
  "/api/admin/analytics/export",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { format = 'csv', startDate, endDate } = req.query;
      
      const data = await analyticsService.exportUsageData({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        format
      });

      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=usage-export-${Date.now()}.${format}`);
      res.send(data);
    } catch (error) {
      console.error("Failed to export analytics:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  }
);
```

### Phase 3: Admin UI Components (Week 2)

#### 3.1 Admin Dashboard Page

```typescript
// src/components/admin/AdminAnalytics.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

export default function AdminAnalytics() {
  const { apiFetch } = useAuth();
  const [userStats, setUserStats] = useState(null);
  const [systemStats, setSystemStats] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [loading, setLoading] = useState(true);

  // Fetch analytics data
  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const [users, system] = await Promise.all([
        apiFetch('/api/admin/analytics/users', {
          params: {
            startDate: dateRange.start,
            endDate: dateRange.end,
            limit: 100
          }
        }),
        apiFetch('/api/admin/analytics/system', {
          params: {
            startDate: dateRange.start,
            endDate: dateRange.end
          }
        })
      ]);

      setUserStats(users);
      setSystemStats(system);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // ... Component implementation with charts and tables
}
```

#### 3.2 User Usage Detail Modal

```typescript
// src/components/admin/UserUsageDetail.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import UniversalModal from '../UniversalModal';

interface UserUsageDetailProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserUsageDetail({ userId, isOpen, onClose }: UserUsageDetailProps) {
  const { apiFetch } = useAuth();
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserDetails();
    }
  }, [userId, isOpen]);

  const loadUserDetails = async () => {
    try {
      setLoading(true);
      const details = await apiFetch(`/api/admin/analytics/users/${userId}`);
      setUserDetails(details);
    } catch (error) {
      console.error('Failed to load user details:', error);
    } finally {
      setLoading(false);
    }
  };

  // ... Detailed user usage display
}
```

### Phase 4: Integration & Migration (Week 2-3)

#### 4.1 Update Message Endpoints

```javascript
// Update server.js message endpoint to use precise token counting
app.post("/api/conversations/:conversationId/messages", async (req, res) => {
  // ... existing validation ...
  
  // Get precise token estimate
  const tokenEstimate = await creditService.estimateMessageCredits(
    req.body.content,
    conversation.Character.model,
    modelProvider,
    {
      systemPrompt: conversation.Character.systemPrompt,
      conversationHistory: previousMessages,
      attachments: req.body.attachments
    }
  );

  // Use precise estimate for credit check
  const requiredCredits = tokenEstimate.creditsNeeded * 1.1; // 10% buffer instead of 20%
  
  // ... rest of endpoint
});
```

#### 4.2 Frontend Integration

```typescript
// Update src/api/messages.ts
const estimateMessageCost = (
  content: string,
  attachments?: MessageAttachment[],
  model?: string
) => {
  // Call backend for precise estimation
  return apiFetch('/api/credit/estimate', {
    method: 'POST',
    body: JSON.stringify({
      content,
      attachments,
      model
    })
  });
};
```

## Implementation Timeline

### Week 1
- [ ] Install and configure tokenizer libraries
- [ ] Implement TokenizerService
- [ ] Update CreditService with precise counting
- [ ] Create analytics database queries

### Week 2
- [ ] Implement admin API endpoints
- [ ] Build admin dashboard UI
- [ ] Create user detail views
- [ ] Add export functionality

### Week 3
- [ ] Integrate tokenizers with message endpoints
- [ ] Update frontend estimation
- [ ] Test and optimize performance
- [ ] Deploy and monitor

## Testing Strategy

### Unit Tests
- Test each tokenizer implementation
- Verify token counts match API responses
- Test analytics aggregation queries

### Integration Tests
- End-to-end message flow with precise counting
- Admin dashboard data accuracy
- Export functionality

### Performance Tests
- Tokenizer performance impact
- Analytics query optimization
- Caching strategies for frequently accessed data

## Monitoring & Optimization

### Key Metrics
- Token estimation accuracy (estimated vs actual)
- Tokenizer performance (ms per request)
- Analytics query performance
- Admin dashboard load times

### Optimization Strategies
- Cache tokenizer instances
- Use database views for complex analytics
- Implement pagination for large datasets
- Add Redis caching for frequently accessed stats

## Security Considerations

- Admin endpoints require admin role
- Rate limit analytics endpoints
- Sanitize export data
- Audit log for admin actions
- PII handling in exports

## Benefits

1. **Accuracy**: Precise token counting reduces uncertainty
2. **Cost Transparency**: Users see exact costs before sending
3. **Admin Insights**: Comprehensive usage analytics
4. **Billing Accuracy**: Precise usage tracking for billing
5. **Optimization**: Identify high-cost patterns and optimize