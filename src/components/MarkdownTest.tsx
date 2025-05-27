import React from "react";
import MarkdownMessage from "./MarkdownMessage";

const MarkdownTest: React.FC = () => {
  const testMarkdown = `# Markdown Test

Here's a test of various markdown elements to ensure they render correctly:

## Lists

### Numbered List
1. **Be Authentic:** Speak from the heart. Let your true self shine through your words and actions, for the Lord desires sincerity.

2. **Listen Well:** Engage in conversation by listening. Show genuine interest in what she has to say. Ask questions and be attentive, as a good shepherd cares for his flock.

3. **Build Confidence:** Find strength in the knowledge that you are a creation of God, valuable and unique. Approach the conversation with the confidence that you have much to offer.

4. **Take Interest in Shared Topics:** Seek common ground. Speak of interests, hobbies, or experiences that you both share. This shall forge a connection.

5. **Be Respectful:** Always remember to treat her with dignity and respect. Kindness is a fruit of the Spirit and shall be your guide.

6. **Practice Patience:** Like wandering the desert, relationships take time to grow and flourish. Be patient and let things develop naturally.

### Bullet Points
- First bullet point with some longer text to test wrapping
- Second bullet point
- Third bullet point with **bold text** and *italic text*
- Fourth bullet point with \`inline code\`

### Nested Lists
1. First item
   - Nested bullet
   - Another nested bullet
2. Second item
   - More nested content
   - Even more nested content

## Other Elements

**Bold text** and *italic text* and \`inline code\`.

> This is a blockquote to test how it renders in the chat interface.

\`\`\`javascript
// Code block test
function hello() {
  console.log("Hello, world!");
}
\`\`\`

[This is a link](https://example.com)

---

## Table Test

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1    | Data     | More data |
| Row 2    | Data     | More data |
`;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6 text-white">
        Markdown Rendering Test
      </h1>

      <div className="bg-zinc-800 p-6 rounded-lg">
        <h2 className="text-lg font-semibold mb-4 text-white">
          Assistant Message Preview:
        </h2>
        <div className="bg-zinc-900/50 p-4 rounded-lg">
          <MarkdownMessage content={testMarkdown} />
        </div>
      </div>

      <div className="mt-8 bg-zinc-800 p-6 rounded-lg">
        <h2 className="text-lg font-semibold mb-4 text-white">Raw Markdown:</h2>
        <pre className="bg-zinc-900 p-4 rounded text-sm text-zinc-300 overflow-x-auto">
          {testMarkdown}
        </pre>
      </div>
    </div>
  );
};

export default MarkdownTest;
