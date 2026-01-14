import { Send, User, Bot, ChevronDown, ChevronRight } from 'lucide-react';
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
    <div className="my-2 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 flex items-center gap-2 text-sm font-medium text-gray-700 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span className="text-base">{icon}</span>
        <span>{title}</span>
      </button>
      {isOpen && (
        <div className="p-3 bg-white border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // Parse content to extract special sections
  const parseContent = (content: string) => {
    const sections: Array<{ type: 'text' | 'reasoning' | 'tool_call' | 'tool_result'; content: string; title?: string }> = [];
    let remainingContent = content;

    // Extract reasoning sections
    const reasoningRegex = /\n💭\s*\*\*Reasoning\*\*:\n```\n([\s\S]*?)\n```/g;
    let match;
    while ((match = reasoningRegex.exec(content)) !== null) {
      sections.push({ type: 'reasoning', content: match[1], title: 'Reasoning' });
      remainingContent = remainingContent.replace(match[0], '');
    }

    // Extract tool call sections
    const toolCallRegex = /\n🔧\s*\*\*Calling tool\*\*:\s*(\w+)\((.*?)\)\n/g;
    while ((match = toolCallRegex.exec(content)) !== null) {
      sections.push({ type: 'tool_call', content: match[2], title: `Tool: ${match[1]}` });
      remainingContent = remainingContent.replace(match[0], '');
    }

    // Extract tool result sections
    const toolResultRegex = /\n✅\s*\*\*Tool result\*\*:\s*(\w+)\n```\n([\s\S]*?)\n```/g;
    while ((match = toolResultRegex.exec(content)) !== null) {
      sections.push({ type: 'tool_result', content: match[2], title: `Result: ${match[1]}` });
      remainingContent = remainingContent.replace(match[0], '');
    }

    // Add remaining text content
    if (remainingContent.trim()) {
      sections.push({ type: 'text', content: remainingContent.trim() });
    }

    return sections;
  };

  const sections = parseContent(message.content);

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary-700" />
        </div>
      )}

      <div
        className={`max-w-[70%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-white border border-gray-200 text-gray-900'
        }`}
      >
        <div className="prose prose-sm max-w-none break-words prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline prose-code:text-pink-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-50 prose-pre:p-3">
          {isUser ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          ) : (
            sections.map((section, index) => {
              if (section.type === 'text') {
                return <Markdown key={index}>{section.content}</Markdown>;
              } else if (section.type === 'reasoning') {
                return (
                  <CollapsibleSection key={index} title={section.title || 'Reasoning'} icon="💭" defaultOpen={false}>
                    <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                      {section.content}
                    </pre>
                  </CollapsibleSection>
                );
              } else if (section.type === 'tool_call') {
                return (
                  <CollapsibleSection key={index} title={section.title || 'Tool Call'} icon="🔧" defaultOpen={true}>
                    <code className="text-xs bg-gray-50 px-2 py-1 rounded font-mono block">
                      {section.content}
                    </code>
                  </CollapsibleSection>
                );
              } else if (section.type === 'tool_result') {
                return (
                  <CollapsibleSection key={index} title={section.title || 'Tool Result'} icon="✅" defaultOpen={false}>
                    <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                      {section.content}
                    </pre>
                  </CollapsibleSection>
                );
              }
              return null;
            })
          )}
        </div>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.toolCalls.map((toolCall, index) => (
              <div
                key={index}
                className="text-xs bg-gray-50 border border-gray-200 rounded p-2"
              >
                <div className="font-mono text-gray-700 break-all">
                  <span className="font-semibold">{toolCall.tool}</span>
                  <span className="text-gray-500">
                    ({JSON.stringify(toolCall.args)})
                  </span>
                </div>
                {toolCall.result && (
                  <div className="mt-1 text-gray-600 whitespace-pre-wrap break-words">
                    {toolCall.result}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-primary-200' : 'text-gray-500'
          }`}
        >
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <User className="w-5 h-5 text-gray-600" />
        </div>
      )}
    </div>
  );
}
