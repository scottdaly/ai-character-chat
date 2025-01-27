const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { OpenAI } = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();

// Database Configuration
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(__dirname, 'database.sqlite'),
  logging: false
});

// Define Models
const User = sequelize.define('User', {
  googleId: { type: DataTypes.STRING, unique: true },
  displayName: DataTypes.STRING,
  email: { type: DataTypes.STRING, unique: true },
  username: { 
    type: DataTypes.STRING, 
    unique: true,
    allowNull: true // Initially null until user sets it
  },
  isOfficial: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

const Character = sequelize.define('Character', {
    name: DataTypes.STRING,
    description: {
      type: DataTypes.TEXT,
      validate: {
        len: [0, 120] // Maximum 120 characters
      }
    },
    model: DataTypes.STRING,
    systemPrompt: DataTypes.TEXT,
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    messageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    timestamps: true
  });

const Conversation = sequelize.define('Conversation', {
  title: DataTypes.STRING,
  lastMessage: DataTypes.TEXT
});

const Message = sequelize.define('Message', {
  content: DataTypes.TEXT,
  role: DataTypes.STRING
}, {
  timestamps: true
});

// Define Relationships
User.hasMany(Character);
Character.belongsTo(User);

User.hasMany(Conversation);
Conversation.belongsTo(User);

Character.hasMany(Conversation);
Conversation.belongsTo(Character);

Conversation.hasMany(Message);
Message.belongsTo(Conversation);

User.hasMany(Message);
Message.belongsTo(User);

const syncOptions = process.env.NODE_ENV === 'development' ? 
  { alter: true } : 
  {};

// Initialize Database
(async () => {
  try {
    // First sync without altering existing tables
    await sequelize.sync();

    // Check if username column exists
    const hasUsernameColumn = await sequelize.query(
      "SELECT name FROM pragma_table_info('Users') WHERE name = 'username'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (hasUsernameColumn.length === 0) {
      // Add username column without UNIQUE constraint first
      await sequelize.query('ALTER TABLE Users ADD COLUMN username VARCHAR(255)');
      
      // Then add the UNIQUE constraint
      await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON Users(username) WHERE username IS NOT NULL');
    }

    // Check if messageCount column exists in Characters table
    const hasMessageCountColumn = await sequelize.query(
      "SELECT name FROM pragma_table_info('Characters') WHERE name = 'messageCount'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (hasMessageCountColumn.length === 0) {
      // Add messageCount column with default value 0
      await sequelize.query('ALTER TABLE Characters ADD COLUMN messageCount INTEGER DEFAULT 0');
    }

    // Create the official Nevermade user if it doesn't exist
    const [officialUser] = await User.findOrCreate({
      where: { username: 'nevermade' },
      defaults: {
        displayName: 'Nevermade',
        email: 'official@nevermade.ai',
        isOfficial: true,
        googleId: 'nevermade-official'
      }
    });

    // Create official characters if they don't exist
    const officialCharacters = [
      {
        name: 'Creative Writing Coach',
        description: 'An expert writing coach who helps you improve your creative writing skills through feedback and exercises.',
        model: 'chatgpt-4o-latest',
        systemPrompt: 'You are a creative writing coach with expertise in various genres and forms. Help users improve their writing through constructive feedback, writing exercises, and specific suggestions for improvement. Focus on elements like character development, plot structure, dialogue, and descriptive language.'
      },
      {
        name: 'Socratic Tutor',
        description: 'A philosophical mentor who helps you explore complex topics through thought-provoking questions and guided discussion.',
        model: 'chatgpt-4o-latest',
        systemPrompt: 'You are a Socratic tutor who helps users explore ideas through careful questioning and logical reasoning. Guide users to discover answers themselves rather than providing them directly. Ask thought-provoking questions that encourage deeper analysis and understanding.'
      },
      {
        name: 'Code Review Expert',
        description: 'A senior software engineer who provides detailed code reviews and helps you improve your programming skills.',
        model: 'chatgpt-4o-latest',
        systemPrompt: 'You are an experienced software engineer conducting code reviews. Focus on best practices, potential improvements, and learning opportunities. Provide specific, actionable feedback while maintaining a constructive and educational tone. Consider aspects like code quality, performance, security, and maintainability.'
      }
    ];

    for (const charData of officialCharacters) {
      await Character.findOrCreate({
        where: {
          name: charData.name,
          UserId: officialUser.id
        },
        defaults: {
          ...charData,
          UserId: officialUser.id
        }
      });
    }

    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Database sync failed:', error);
  }
})();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true
}));
app.use(passport.initialize());

// Auth Middleware - Define before routes
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Public Character Routes
app.get('/api/characters/featured', async (req, res) => {
  try {
    // Get all official characters
    const characters = await Character.findAll({
      include: [{
        model: User,
        where: { isOfficial: true },
        attributes: ['username', 'displayName', 'isOfficial']
      }],
      order: [
        ['createdAt', 'DESC']
      ],
      limit: 6
    });

    res.json(characters || []);
  } catch (err) {
    console.error('Failed to load featured characters:', err);
    res.status(500).json({ error: 'Failed to load characters' });
  }
});

app.get('/api/characters/explore', authenticateToken, async (req, res) => {
  try {
    // Get public characters created by other users
    const characters = await Character.findAll({
      where: {
        UserId: {
          [Sequelize.Op.not]: req.user.id // Exclude current user's characters
        },
        isPublic: true // Only show public characters
      },
      include: [{
        model: User,
        attributes: ['username', 'displayName', 'isOfficial']
      }],
      order: [
        ['createdAt', 'DESC']
      ]
    });

    res.json(characters || []);
  } catch (err) {
    console.error('Failed to load explore characters:', err);
    res.status(500).json({ error: 'Failed to load characters' });
  }
});

// Passport Configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const [user] = await User.findOrCreate({
      where: { googleId: profile.id },
      defaults: {
        displayName: profile.displayName,
        email: profile.emails[0].value
      }
    });
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// OpenAI Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Anthropic Configuration
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    // Redirect to username setup if username is not set
    const redirectUrl = !req.user.username ? 
      `${process.env.FRONTEND_URL}/setup-username?token=${token}` :
      `${process.env.FRONTEND_URL}/auth-success?token=${token}`;
    res.redirect(redirectUrl);
  }
);

app.get('/api/me', authenticateToken, async (req, res) => {
  res.json(req.user);
});

// Character Routes
app.get('/api/characters', authenticateToken, async (req, res) => {
  try {
    // Get all characters that the user has conversations with
    const userConversations = await Conversation.findAll({
      where: { UserId: req.user.id },
      attributes: ['CharacterId']
    });
    
    const characterIdsWithConversations = userConversations.map(conv => conv.CharacterId);

    // Get both user-created characters and characters with conversations
    const characters = await Character.findAll({
      where: {
        [Sequelize.Op.or]: [
          { UserId: req.user.id }, // Characters created by the user
          { id: characterIdsWithConversations } // Characters the user has chatted with
        ]
      },
      include: [{
        model: User,
        attributes: ['username', 'displayName', 'isOfficial']
      }],
      order: [
        [{ model: User, as: 'User' }, 'isOfficial', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });
    res.json(characters);
  } catch (err) {
    console.error('Failed to load characters:', err);
    res.status(500).json({ error: 'Failed to load characters' });
  }
});

app.get('/api/characters/:characterId', authenticateToken, async (req, res) => {
  try {
    const character = await Character.findOne({
      where: { 
        id: req.params.characterId
      },
      include: [{
        model: User,
        attributes: ['username', 'displayName']
      }]
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json(character);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load character' });
  }
});

app.post('/api/characters', authenticateToken, async (req, res) => {
  try {
    const character = await Character.create({
      ...req.body,
      UserId: req.user.id
    });
    res.status(201).json(character);
  } catch (err) {
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Conversation Routes
app.get('/api/characters/:characterId/conversations', authenticateToken, async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
        where: {
          CharacterId: req.params.characterId,
          UserId: req.user.id
        },
        include: [{
          model: Character,
          attributes: ['name', 'model'],
          required: true
        }],
        order: [['createdAt', 'DESC']]
      });
      
      res.json(conversations);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load conversations' });
    }
});

app.post('/api/characters/:characterId/conversations', authenticateToken, async (req, res) => {
  try {
    const conversation = await Conversation.create({
      title: 'New Conversation',
      lastMessage: '',
      UserId: req.user.id,
      CharacterId: req.params.characterId
    });
    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Message Routes
app.get('/api/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: {
        ConversationId: req.params.conversationId,
        UserId: req.user.id
      },
      order: [['createdAt', 'ASC']]
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.post('/api/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      where: {
        id: req.params.conversationId,
        UserId: req.user.id
      },
      include: [Character]
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!conversation.Character) {
      return res.status(400).json({ error: 'Character not found for conversation' });
    }

    // Get previous messages in the conversation
    const previousMessages = await Message.findAll({
      where: {
        ConversationId: conversation.id
      },
      order: [['createdAt', 'ASC']]
    });

    // Save user message
    const userMessage = await Message.create({
      content: req.body.content,
      role: 'user',
      UserId: req.user.id,
      ConversationId: conversation.id,
      CharacterId: conversation.CharacterId
    });

    // Increment message count for the character
    await conversation.Character.increment('messageCount');

    try {
      // Prepare conversation history for OpenAI
      const messageHistory = [
        { role: 'system', content: conversation.Character.systemPrompt },
        ...previousMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: req.body.content }
      ];

      // Get AI response with full conversation history
      let aiResponse;
      if (conversation.Character.model.startsWith('claude-')) {
        
        // Format messages for Claude API
        const formattedMessages = messageHistory.map(msg => {
          if (msg.role === 'system') {
            return {
              role: 'user',
              content: `You are ${conversation.Character.name}. Here is your character description and instructions:\n${msg.content}`
            };
          }
          return {
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          };
        });

        try {
          const response = await anthropic.messages.create({
            model: conversation.Character.model,
            max_tokens: 1024,
            messages: formattedMessages,
            system: conversation.Character.systemPrompt
          });

          if (!response.content || !response.content[0] || !response.content[0].text) {
            throw new Error('Invalid response from Claude API');
          }

          aiResponse = response.content[0].text;
        } catch (claudeError) {
          console.error('Claude API error:', claudeError);
          throw new Error('Failed to get AI response: ' + (claudeError.message || 'Unknown error'));
        }
      } else {
        const response = await openai.chat.completions.create({
          model: conversation.Character.model,
          messages: messageHistory
        });
        aiResponse = response.choices[0].message.content;
      }

      // Save AI message
      const aiMessage = await Message.create({
        content: aiResponse,
        role: 'assistant',
        UserId: req.user.id,
        ConversationId: conversation.id,
        CharacterId: conversation.CharacterId
      });

      // If this is the first message exchange, generate a title
      if (conversation.title === 'New Conversation') {
        try {
          const titleResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: 'You are a conversation title generator. Generate a brief, engaging title (max 30 characters) based on the conversation. The title should capture the essence of the discussion. Respond with ONLY the title, no quotes or extra text.' 
              },
              { role: 'user', content: `User: ${req.body.content}\nAI: ${aiResponse}` }
            ],
            max_tokens: 10,
            temperature: 0.7
          });

          const newTitle = titleResponse.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
          await conversation.update({ 
            title: newTitle,
            lastMessage: aiResponse.substring(0, 50)
          });
        } catch (titleError) {
          console.error('Failed to generate title:', titleError);
          // Fall back to using the first message as title if title generation fails
          await conversation.update({
            title: aiResponse.substring(0, 30),
            lastMessage: aiResponse.substring(0, 50)
          });
        }
      } else {
        // Just update the last message for existing conversations
        await conversation.update({
          lastMessage: aiResponse.substring(0, 50)
        });
      }

      // Return both messages as an array
      return res.json([userMessage, aiMessage]);
    } catch (aiError) {
      // If AI response fails, delete the user message and throw error
      await userMessage.destroy();
      throw new Error('Failed to get AI response');
    }
  } catch (err) {
    console.error('Message error:', err);
    res.status(500).json({ error: err.message || 'Failed to send message' });
  }
});

// Add username setup endpoint
app.post('/api/setup-username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }

    // Check if username is reserved (nevermade)
    if (username.toLowerCase() === 'nevermade') {
      return res.status(400).json({ error: 'This username is reserved' });
    }

    // Check if username is already taken
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Update user's username
    await req.user.update({ username });

    // Generate a new token with updated user data
    const token = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      success: true, 
      username,
      token // Send back a new token
    });
  } catch (err) {
    console.error('Username setup error:', err);
    res.status(500).json({ error: 'Failed to set username' });
  }
});

// Logout Route
app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// Add endpoint to toggle character visibility
app.put('/api/characters/:characterId/visibility', authenticateToken, async (req, res) => {
  try {
    const character = await Character.findOne({
      where: {
        id: req.params.characterId,
        UserId: req.user.id // Only allow updating own characters
      }
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    await character.update({ isPublic: req.body.isPublic });
    res.json(character);
  } catch (err) {
    console.error('Failed to update character visibility:', err);
    res.status(500).json({ error: 'Failed to update character visibility' });
  }
});

// Add endpoint to update character details
app.put('/api/characters/:characterId', authenticateToken, async (req, res) => {
  try {
    const character = await Character.findOne({
      where: {
        id: req.params.characterId,
        UserId: req.user.id // Only allow updating own characters
      }
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Validate required fields
    if (!req.body.name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!req.body.systemPrompt?.trim()) {
      return res.status(400).json({ error: 'System prompt is required' });
    }

    // Validate model
    const allowedModels = [
      'chatgpt-4o-latest', 
      'gpt-4o-mini',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022'
    ];
    if (!allowedModels.includes(req.body.model)) {
      return res.status(400).json({ error: 'Invalid model selected' });
    }

    // Update allowed fields
    const updatedCharacter = await character.update({
      name: req.body.name.trim(),
      description: req.body.description?.trim() || '',
      model: req.body.model,
      systemPrompt: req.body.systemPrompt.trim(),
      isPublic: Boolean(req.body.isPublic)
    });

    // Return the updated character with user info
    const characterWithUser = await Character.findOne({
      where: { id: updatedCharacter.id },
      include: [{
        model: User,
        attributes: ['username', 'displayName', 'isOfficial']
      }]
    });

    res.json(characterWithUser);
  } catch (err) {
    console.error('Failed to update character:', err);
    res.status(500).json({ error: 'Failed to update character' });
  }
});

// Add endpoint to delete a conversation
app.delete('/api/conversations/:conversationId', authenticateToken, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      where: {
        id: req.params.conversationId,
        UserId: req.user.id // Only allow deleting own conversations
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Delete all messages in the conversation first
    await Message.destroy({
      where: {
        ConversationId: conversation.id
      }
    });

    // Then delete the conversation
    await conversation.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete conversation:', err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Add endpoint to get a single conversation
app.get('/api/conversations/:conversationId', authenticateToken, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      where: {
        id: req.params.conversationId,
        UserId: req.user.id
      },
      include: [{
        model: Character,
        attributes: ['name', 'model']
      }]
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (err) {
    console.error('Failed to load conversation:', err);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));