import SummaryResultView from './SummaryResultView';

// This defines what a 'message' object looks like
export interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
  type?: 'text' | 'summary' | 'digest';
  data?: any; // For summary object
  error?: string;
  isLoading?: boolean;
}

// Simple markdown-like parser for AI responses
const formatAIResponse = (text: string) => {
  // Split into lines for processing
  const lines = text.split('\n');

  return lines.map((line, index) => {
    // Check for section headers with emojis (📌, 📧, 📋, ⚡)
    if (/^[📌📧📋⚡🔍💡✅❌⚠️]/.test(line.trim())) {
      return (
        <div key={index} className="mt-3 mb-1.5 first:mt-0">
          <span className="text-[#22d3ee] font-semibold">{line}</span>
        </div>
      );
    }

    // Check for bullet points
    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
      const content = line.trim().replace(/^[•-]\s*/, '');
      return (
        <div key={index} className="flex items-start gap-2 ml-2 my-0.5">
          <span className="text-[#22d3ee] mt-0.5">•</span>
          <span>{formatInlineStyles(content)}</span>
        </div>
      );
    }

    // Empty lines become spacing
    if (line.trim() === '') {
      return <div key={index} className="h-2" />;
    }

    // Regular text with inline formatting
    return <div key={index} className="my-0.5">{formatInlineStyles(line)}</div>;
  });
};

// Handle **bold** text
const formatInlineStyles = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

export const ChatMessage = ({ message }: { message: Message }) => {
  const isUser = message.sender === 'user';

  if (message.type === 'summary') {
    return (
      <div className={`flex w-full items-start gap-2 sm:gap-2.5 lg:gap-3`}>
        <img src="/logo.png" alt="Meeco Avatar" className="w-5 h-5 sm:w-6 sm:h-6 lg:w-6 lg:h-6 xl:w-7 xl:h-7 rounded-full flex-shrink-0" />
        <div className="w-full max-w-[95%]">
          {message.isLoading ? (
            <div className="bg-[#171717] text-gray-400 p-3 rounded-xl border border-[#262626] text-sm animate-pulse">
              Summarizing email...
            </div>
          ) : (
            <SummaryResultView
              summary={message.data}
              error={message.error}
            // onClear logic is removed or handled via removing message if needed, but for history we keep it.
            />
          )}
        </div>
      </div>
    );
  }

  // Fallback for regular text messages
  return (
    <div className={`flex w-full items-start gap-2.5 sm:gap-3 lg:gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <img src="/logo.png" alt="Meeco Avatar" className="w-6 h-6 sm:w-7 sm:h-7 lg:w-7 lg:h-7 rounded-full flex-shrink-0" />
      )}
      <div className={`max-w-[85%] rounded-lg px-3 sm:px-3.5 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm lg:text-base ${isUser ? 'bg-[#22d3ee] text-[#121212] font-medium' : 'bg-[#171717] text-gray-200'}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        ) : (
          <div className="whitespace-pre-wrap break-words">
            {formatAIResponse(message.text)}
          </div>
        )}
      </div>
    </div>
  );
};