import { User, Bot, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import Markdown from 'markdown-to-jsx';
import { useState } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result?: string;
}

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="my-1.5 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-150 flex items-center gap-2 text-sm font-medium text-gray-700 transition-all duration-200"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 transition-transform duration-200" /> : <ChevronRight className="w-4 h-4 transition-transform duration-200" />}
        <span className="text-base">{icon}</span>
        <span className="font-semibold">{title}</span>
      </button>
      {isOpen && (
        <div className="p-2.5 bg-white border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}

interface ChatMessageProps {
  message: Message;
  onDelete?: (messageId: string) => void;
}

// Content block types
interface ContentBlock {
  type: 'text' | 'reasoning' | 'tool_call' | 'tool_result';
  content: string;
  title?: string;
}

export function ChatMessage({ message, onDelete }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // Parse content preserving original order
  const parseContentPreservingOrder = (content: string): ContentBlock[] => {
    const blocks: ContentBlock[] = [];
    let remaining = content;
    let pos = 0;

    while (pos < remaining.length) {
      // Check for ALL possible special sections and find the CLOSEST one
      // This prevents skipping over sections when multiple patterns exist

      // Patterns to check
      const reasoningPattern = /(?:\r?\n|^)💭\s*\*?\*?Reasoning\*?\*?:\s*\r?\n```\r?\n([\s\S]*?)\r?\n```/;
      const toolCallPattern = /(?:\r?\n|^)🔧\s*\*?\*?Calling tool\*?\*?:\s*([\w.-]+)\((.*?)\)\r?\n/;
      const toolResultPattern = /(?:\r?\n|^)✅\s*\*?\*?Tool result\*?\*?:\s*([\w.-]+)\r?\n```\r?\n([\s\S]*?)\r?\n```/;

      // Search for all patterns in the remaining content
      const remainingFromPos = remaining.slice(pos);
      const reasoningMatch = remainingFromPos.match(reasoningPattern);
      const toolCallMatch = remainingFromPos.match(toolCallPattern);
      const toolResultMatch = remainingFromPos.match(toolResultPattern);

      // Find which match appears first (lowest index)
      let firstMatch: {
        type: 'reasoning' | 'tool_call' | 'tool_result';
        match: RegExpMatchArray;
        index: number;
      } | null = null;

      if (reasoningMatch && reasoningMatch.index !== undefined) {
        firstMatch = { type: 'reasoning', match: reasoningMatch, index: reasoningMatch.index };
      }
      if (toolCallMatch && toolCallMatch.index !== undefined) {
        if (!firstMatch || toolCallMatch.index < firstMatch.index) {
          firstMatch = { type: 'tool_call', match: toolCallMatch, index: toolCallMatch.index };
        }
      }
      if (toolResultMatch && toolResultMatch.index !== undefined) {
        if (!firstMatch || toolResultMatch.index < firstMatch.index) {
          firstMatch = { type: 'tool_result', match: toolResultMatch, index: toolResultMatch.index };
        }
      }

      // Process the closest match
      if (firstMatch) {
        // Add any text before this match
        const beforeText = remaining.slice(pos, pos + firstMatch.index).trim();
        if (beforeText) {
          blocks.push({ type: 'text', content: beforeText });
        }

        // Add the matched block based on type
        if (firstMatch.type === 'reasoning') {
          blocks.push({ type: 'reasoning', content: firstMatch.match[1]!, title: 'Reasoning' });
          pos += firstMatch.index + firstMatch.match[0]!.length;
        } else if (firstMatch.type === 'tool_call') {
          blocks.push({
            type: 'tool_call',
            content: firstMatch.match[2]!,
            title: `Tool: ${firstMatch.match[1]}`
          });
          pos += firstMatch.index + firstMatch.match[0]!.length;
        } else if (firstMatch.type === 'tool_result') {
          blocks.push({
            type: 'tool_result',
            content: firstMatch.match[2]!,
            title: `Result: ${firstMatch.match[1]}`
          });
          pos += firstMatch.index + firstMatch.match[0]!.length;
        }
        continue;
      }

      // No more special sections found, add remaining text
      const remainingText = remaining.slice(pos).trim();
      if (remainingText) {
        blocks.push({ type: 'text', content: remainingText });
      }
      break;
    }

    return blocks;
  };

  const sections = parseContentPreservingOrder(message.content);

  // Check if content contains error message
  const hasError = message.content.includes('❌ **Error**') ||
                   message.content.includes('\\n\\n❌ **Error**:');

  // Check if content already has tool calls/results (formatted text)
  const hasFormattedToolCalls = sections.some(
    s => s.type === 'tool_call' || s.type === 'tool_result'
  );

 return (
    <div className={`flex w-full gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
          <Bot className="w-7 h-7 text-white" />
        </div>
      )}

      <div
        className={`rounded-xl px-4 py-3 shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-md max-w-[90%]'
            : hasError
              ? 'bg-red-50 border-2 border-red-300 text-red-900 max-w-[95%]'
              : 'bg-white border border-gray-200 text-gray-900 max-w-[95%]'
        }`}
      >
        <div className="prose prose-sm max-w-none break-words prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline prose-code:text-pink-600 prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-50 prose-pre:p-3">
          {isUser ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          ) : (
            sections.map((section, index) => {
              if (section.type === 'text') {
                return <Markdown key={index}>{section.content}</Markdown>;
              } else if (section.type === 'reasoning') {
                return (
                  <CollapsibleSection key={index} title={section.title || 'Reasoning'} icon="💭" defaultOpen={false}>
                    <pre className="text-xs bg-gray-50 p-2 rounded-md overflow-x-auto whitespace-pre-wrap break-words leading-relaxed border border-gray-200">
                      {section.content}
                    </pre>
                  </CollapsibleSection>
                );
              } else if (section.type === 'tool_call') {
                return (
                  <CollapsibleSection key={index} title={section.title || 'Tool Call'} icon="🔧" defaultOpen={true}>
                    <code className="text-xs bg-gray-50 px-2.5 py-1.5 rounded-md font-mono block border border-gray-200">
                      {section.content}
                    </code>
                  </CollapsibleSection>
                );
              } else if (section.type === 'tool_result') {
                return (
                  <CollapsibleSection key={index} title={section.title || 'Tool Result'} icon="✅" defaultOpen={false}>
                    <pre className="text-xs bg-gray-50 p-2 rounded-md overflow-x-auto whitespace-pre-wrap break-words leading-relaxed border border-gray-200">
                      {section.content}
                    </pre>
                  </CollapsibleSection>
                );
              }
              return null;
            })
          )}
        </div>

        {/* Only show toolCalls array if content doesn't already have formatted tool calls */}
        {!hasFormattedToolCalls && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.toolCalls.map((toolCall, index) => (
              <div
                key={index}
                className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2 shadow-sm"
              >
                <div className="font-mono text-gray-700 break-all">
                  <span className="font-semibold">{toolCall.tool}</span>
                  <span className="text-gray-500">
                    ({JSON.stringify(toolCall.args)})
                  </span>
                </div>
                {toolCall.result && (
                  <div className="mt-1.5 text-gray-600 whitespace-pre-wrap break-words">
                    {toolCall.result}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className={`text-xs mt-2 flex items-center gap-2 ${
            isUser ? 'text-primary-200' : 'text-gray-500'
          }`}
        >
          <span className="font-medium">{message.timestamp.toLocaleTimeString()}</span>
          {isUser && onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="opacity-60 hover:opacity-100 transition-all duration-200 flex items-center gap-1 hover:scale-105"
              title="Delete this message and all subsequent messages"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-md">
          <User className="w-7 h-7 text-white" />
        </div>
      )}
    </div>
  );
}
