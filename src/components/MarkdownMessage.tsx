import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  content,
  className = "",
}) => {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-medium mb-1 text-zinc-900 dark:text-zinc-100">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-medium mb-1 text-zinc-900 dark:text-zinc-100">
              {children}
            </h6>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside mb-3 space-y-1 pl-6 ml-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside mb-3 space-y-1 pl-6 ml-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1">{children}</li>
          ),

          // Emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-950 dark:text-zinc-50">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-zinc-950 dark:text-zinc-50">
              {children}
            </em>
          ),

          // Code
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="dark:bg-zinc-700/50 bg-zinc-200/50 dark:text-zinc-200 text-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 p-3 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 p-3 rounded-lg text-sm font-mono overflow-x-auto mb-3 border border-zinc-700 dark:border-zinc-600">
              {children}
            </pre>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="dark:text-blue-400 dark:hover:text-blue-300 text-blue-600 hover:text-blue-500 underline transition-colors"
            >
              {children}
            </a>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-zinc-400 dark:border-zinc-600 px-4 py-2 mb-3 bg-zinc-200/30 dark:bg-zinc-800/30 text-xl rounded-r">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => (
            <hr className="border-zinc-400 dark:border-zinc-600 my-4" />
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full border border-zinc-400 dark:border-zinc-600 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-200 dark:bg-zinc-800">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-zinc-200 dark:bg-zinc-800">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-zinc-400 dark:border-zinc-600 last:border-b-0">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-zinc-800 dark:text-zinc-200 border-r border-zinc-400 dark:border-zinc-600 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 border-r border-zinc-400 dark:border-zinc-600 last:border-r-0">
              {children}
            </td>
          ),

          // Strikethrough (from remark-gfm)
          del: ({ children }) => (
            <del className="line-through text-zinc-400 dark:text-zinc-400">
              {children}
            </del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownMessage;
