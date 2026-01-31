import { useState, useEffect } from 'react';

// -----------------------------
// Digest Types
// -----------------------------
interface DigestItem {
  id?: string;
  category?: string;
  email_title: string;
  sender: string;
  summary: string;
  action_items: string[];
  important_details: string[];
  intent: string;
  sentiment: string;
}

interface DigestSection {
  title: string;
  items: DigestItem[];
}

interface DigestData {
  title: string;
  sections: DigestSection[];
}

// -----------------------------
// Component Props
// -----------------------------
interface DailyDigestViewProps {
  onClose: () => void;
  selectedDate?: string; // Optional date in YYYY-MM-DD format
  onDigestComplete?: (digestData: DigestData) => void; // Callback when digest is loaded
}

// -----------------------------
// Component
// -----------------------------
export default function DailyDigestView({ onClose, selectedDate, onDigestComplete }: DailyDigestViewProps) {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Reset states when starting a new request
    setIsLoading(true);
    setError("");
    setDigest(null);

    // Send message with optional date parameter
    const message: any = { type: "GET_DAILY_DIGEST" };
    if (selectedDate) {
      message.date = selectedDate;
    }

    chrome.runtime.sendMessage(message, (response) => {
      setIsLoading(false);

      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message || "An unknown error occurred.");
        setDigest(null);
        return;
      }

      if (response?.error) {
        setError(response.error);
        setDigest(null);
        return;
      }

      if (!response?.summary) {
        setError("No summary received from server.");
        setDigest(null);
        return;
      }

      try {
        let parsed: DigestData;
        if (typeof response.summary === 'string') {
          if (!response.summary.trim().startsWith('{')) {
            setError(response.summary); // Likely a plain text error/empty message
            setDigest(null);
            return;
          }
          parsed = JSON.parse(response.summary);
        } else {
          parsed = response.summary as DigestData;
        }

        // Validate essential structure
        if (!parsed.sections || !Array.isArray(parsed.sections)) {
          throw new Error('Invalid digest structure');
        }

        setDigest(parsed);

        // Call completion callback to save to history
        if (onDigestComplete) {
          onDigestComplete(parsed);
        }
      } catch (error: any) {
        console.error('Error parsing digest:', error);
        setError("Invalid digest format received.");
        setDigest(null);
      }
    });
  }, [selectedDate, onDigestComplete]);

  return (
    <div className="relative p-3 bg-[#171717] border border-[#262626] rounded-xl text-white mb-3 shadow-lg max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <h3 className="font-bold text-[#22d3ee] mb-3 text-sm flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-[#22d3ee] rounded-full"></span>
        {selectedDate
          ? `Digest - ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : "Today's Digest"}
      </h3>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#22d3ee] mx-auto mb-3"></div>
          <p className="text-gray-400 text-xs">Analyzing emails (Primary, Social, Promotions)...</p>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400 font-semibold">{error}</p>
        </div>
      )}

      {/* Digest Content */}
      {digest && !error && !isLoading && (
        <div className="space-y-5">
          {digest.sections.map((section, sIdx) => (
            <div key={sIdx}>
              <h4 className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-3 border-b border-[#262626] pb-1">
                {section.title}
              </h4>
              <div className="space-y-3">
                {section.items.map((item, iIdx) => (
                  <div key={iIdx} className="bg-[#1e1e1e] p-3 rounded-lg border border-[#333] hover:border-[#444] transition-colors">
                    {/* Header */}
                    <div className="mb-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {item.category && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${item.category.toLowerCase() === 'primary' ? 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10' :
                                item.category.toLowerCase() === 'social' ? 'text-pink-400 border-pink-400/30 bg-pink-400/10' :
                                  item.category.toLowerCase() === 'promotions' ? 'text-green-400 border-green-400/30 bg-green-400/10' :
                                    'text-gray-400 border-gray-600'
                                }`}>
                                {item.category}
                              </span>
                            )}
                            <h5 className="font-semibold text-white text-xs leading-tight line-clamp-1">{item.email_title || "Untitled Email"}</h5>
                          </div>
                          <p className="text-[10px] text-gray-400">From: <span className="text-gray-300">{item.sender || "Unknown"}</span></p>
                        </div>

                        {item.sentiment && (
                          <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${item.sentiment.toLowerCase() === 'positive' ? 'text-green-400 bg-green-400/10' :
                            item.sentiment.toLowerCase() === 'negative' ? 'text-red-400 bg-red-400/10' :
                              item.sentiment.toLowerCase() === 'urgent' ? 'text-orange-400 bg-orange-400/10' :
                                'text-gray-400 bg-gray-700/30'
                            }`}>
                            {item.sentiment}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-gray-300 mb-2 leading-relaxed border-l-2 border-[#262626] pl-2">
                      {item.summary}
                    </p>

                    {/* Actions */}
                    {item.action_items && item.action_items.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {item.action_items.map((action, aIdx) => (
                          <div key={aIdx} className="flex items-start gap-1.5">
                            <input type="checkbox" className="mt-0.5 w-3 h-3 rounded border-gray-600 bg-[#262626] text-[#22d3ee]" readOnly />
                            <span className="text-[11px] text-gray-200">{action}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Important Details */}
                    {item.important_details && item.important_details.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {item.important_details.map((detail, dIdx) => (
                          <span key={dIdx} className="text-[10px] bg-[#262626] text-gray-400 px-1.5 py-0.5 rounded border border-[#333]">
                            {detail}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer Tags */}
                    {item.intent && (
                      <div className="flex gap-2 mt-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase ${item.intent.toLowerCase() === 'urgent' ? 'text-orange-400 bg-orange-400/10 border-orange-400/20' :
                          item.intent.toLowerCase() === 'request' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
                            item.intent.toLowerCase() === 'meeting' ? 'text-purple-400 bg-purple-400/10 border-purple-400/20' :
                              item.intent.toLowerCase() === 'follow-up' ? 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20' :
                                'text-gray-500 bg-[#121212] border-[#262626]'
                          }`}>
                          {item.intent}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
