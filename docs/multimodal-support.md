# Multimodal Image Support

This document describes the multimodal image support functionality that allows users to upload and send images to AI characters that support vision capabilities.

## Overview

The AI Character Chat application now supports sending images to characters whose underlying AI models have vision capabilities. This includes models from OpenAI (GPT-4o series), Google (Gemini series), and Anthropic (Claude series).

## Features

### Frontend Features

1. **Image Upload Interface**

   - Image upload button appears only for models that support images
   - Multiple image selection support
   - Image preview with removal capability
   - File type validation (images only)
   - File size validation (5MB limit per image)

2. **Message Display**

   - Images are displayed in messages alongside text
   - Responsive image sizing with max height of 300px
   - Support for various image formats (JPEG, PNG, GIF, WebP)

3. **Model Detection**
   - Automatic detection of model capabilities using centralized configuration
   - Dynamic UI updates based on selected character's model
   - Placeholder text changes to indicate image support

### Backend Features

1. **Database Support**

   - Messages table includes `attachments` field for storing image data
   - JSON serialization/deserialization of attachment metadata
   - Backward compatibility with existing text-only messages

2. **API Support**

   - Enhanced message endpoint to accept attachments
   - Multimodal message history handling
   - Provider-specific image format conversion

3. **AI Provider Integration**
   - **OpenAI**: Uses vision-enabled models with image_url format
   - **Google AI**: Supports inlineData format with base64 images
   - **Anthropic**: Uses Claude's vision API with base64 image sources

## Technical Implementation

### Message Structure

```typescript
interface MessageAttachment {
  type: "image";
  data: string; // base64 encoded data URL
  mimeType: string; // e.g., "image/jpeg", "image/png"
  name?: string; // optional filename
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt: Date;
  ConversationId: string;
  CharacterId: string;
  UserId: string;
  attachments?: MessageAttachment[];
}
```

### Model Configuration

Models are configured with `inputTypes` to indicate their capabilities:

```javascript
{
  id: "gpt-4o-mini-2024-07-18",
  displayName: "GPT-4o Mini",
  provider: "OpenAI",
  tier: "free",
  inputTypes: ["text", "images"], // Supports both text and images
}
```

### API Format Conversion

The server automatically converts between different AI provider formats:

#### OpenAI Format

```javascript
{
  role: "user",
  content: [
    { type: "text", text: "What's in this image?" },
    {
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,..." }
    }
  ]
}
```

#### Claude Format

```javascript
{
  role: "user",
  content: [
    { type: "text", text: "What's in this image?" },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: "base64-data-here"
      }
    }
  ]
}
```

#### Google AI Format

```javascript
{
  role: "user",
  parts: [
    { text: "What's in this image?" },
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: "base64-data-here"
      }
    }
  ]
}
```

## Usage

### For Users

1. **Select a Character**: Choose a character that uses a vision-enabled model
2. **Upload Images**: Click the image icon in the message input area
3. **Select Files**: Choose one or more image files (max 5MB each)
4. **Preview**: Review selected images in the input area
5. **Send**: Send your message with or without text content

### For Developers

#### Adding New Vision Models

1. Update both frontend and backend model configurations:

   ```javascript
   {
     id: "new-vision-model",
     displayName: "New Vision Model",
     provider: "Provider",
     tier: "pro",
     inputTypes: ["text", "images"], // Include "images" for vision support
   }
   ```

2. Ensure the provider's API integration supports the model

#### Extending Attachment Types

To support additional attachment types (e.g., audio, video):

1. Update the `MessageAttachment` interface
2. Add validation in the frontend upload handler
3. Update the server's multimodal processing logic
4. Add provider-specific format conversion

## Limitations

1. **File Size**: Maximum 5MB per image
2. **File Types**: Images only (JPEG, PNG, GIF, WebP)
3. **Model Support**: Only vision-enabled models support images
4. **Storage**: Images are stored as base64 in the database (consider external storage for production)

## Security Considerations

1. **File Validation**: All uploaded files are validated for type and size
2. **Content Scanning**: Consider implementing content moderation for uploaded images
3. **Rate Limiting**: Image uploads should be rate-limited to prevent abuse
4. **Storage Limits**: Monitor database size growth due to base64 image storage

## Performance Considerations

1. **Image Compression**: Consider client-side image compression before upload
2. **Lazy Loading**: Implement lazy loading for message images
3. **Caching**: Cache processed images to improve response times
4. **External Storage**: Consider moving to external image storage (S3, Cloudinary) for production

## Future Enhancements

1. **Audio Support**: Add support for audio messages
2. **Video Support**: Add support for video uploads
3. **Image Editing**: Basic image editing capabilities
4. **OCR Integration**: Extract text from images automatically
5. **Image Generation**: Support for AI image generation models
6. **Batch Processing**: Support for multiple image analysis in a single request

## Troubleshooting

### Common Issues

1. **Images Not Displaying**: Check if the model supports images and the base64 data is valid
2. **Upload Failures**: Verify file size and type restrictions
3. **API Errors**: Check provider-specific image format requirements
4. **Performance Issues**: Monitor database size and consider image optimization

### Debug Information

Enable debug logging to see:

- Model capability detection
- Image processing steps
- API request/response formats
- Error details

```javascript
console.log(
  `[MODEL SELECTION] Using model: ${model} supports images: ${supportsImages(
    model
  )}`
);
```
