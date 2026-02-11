import { useState, useEffect, useRef, KeyboardEvent, FormEvent } from "react";
import SummaryResultView from "./SummaryResultView"; // <-- Import our new component
import DailyDigestView from "./DailyDigestView";
import { useAutocomplete } from "../hooks/useAutocomplete.js"; // <-- Import our new hook
import EnhancementMenu from "./EnhancementMenu.js"; // <-- Import our new component
import Tooltip from "./Tooltip";

//rag
import { askQuestion, askQuestionStream, syncModelPreference, enhanceText } from "../services/api.js";
import { ChatMessage, Message } from "./ChatMessage.js";

interface ChatScreenProps {
  isLoggedIn: boolean;
  onLoginClick: () => void;
  activeConversationId: string | null;
  onConversationChange: (id: string | null) => void;
  onCreateConversation: (msg: Message) => string;
  onAddMessage: (id: string, msg: Message) => void;
  getConversation: (id: string) => any;
}

type ActiveView = "none" | "digest" | "summarize";

function ChatScreen({ isLoggedIn, onLoginClick, activeConversationId, onConversationChange, onCreateConversation, onAddMessage, getConversation }: ChatScreenProps) {
  const [prompt, setPrompt] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("none");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Sync model preference on mount and login
  useEffect(() => {
    if (isLoggedIn) {
      syncModelPreference();
    }
  }, [isLoggedIn]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);


  const [isRagEnabled, setIsRagEnabled] = useState(false); // RAG Default OFF or ON based on preference? Let's default OFF or maintain state. User said "small icon... on and off button".


  const [isDraftMode, setIsDraftMode] = useState(false);


  const [messages, setMessages] = useState<Message[]>([]);

  // Load conversation when ID changes
  useEffect(() => {
    if (activeConversationId) {
      const convo = getConversation(activeConversationId);
      if (convo) {
        setMessages(convo.messages);
      }
    } else {
      setMessages([]); // New chat
    }
  }, [activeConversationId, getConversation]);

  // Refs to access current state in message listener
  const conversationIdRef = useRef<string | null>(activeConversationId);
  const onAddMessageRef = useRef(onAddMessage);
  const onCreateConversationRef = useRef(onCreateConversation);
  const onConversationChangeRef = useRef(onConversationChange);

  // Keep refs in sync with props/state
  useEffect(() => {
    conversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    onAddMessageRef.current = onAddMessage;
    onCreateConversationRef.current = onCreateConversation;
    onConversationChangeRef.current = onConversationChange;
  }, [onAddMessage, onCreateConversation, onConversationChange]);

  const [isRagLoading, setIsRagLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);


  const handleAskQuestionSubmit = async (e: FormEvent) => {
    console.log("✅ Submit button clicked or Enter pressed");

    e.preventDefault();
    if (!prompt.trim() || isRagLoading || !isLoggedIn) return;

    // 1. Create User Message
    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      text: prompt,
    };

    setMessages((prev) => [...prev, userMessage]); // Optimistic update

    // 2. Handle Conversation ID (Create if new, or use existing)
    let currentConversationId = activeConversationId;
    if (!currentConversationId) {
      currentConversationId = onCreateConversation(userMessage);
      onConversationChange(currentConversationId);
    } else {
      onAddMessage(currentConversationId, userMessage);
    }

    // Clear input
    setPrompt("");
    clearSuggestion();
    setIsRagLoading(true);

    // --- DRAFT REPLY MODE ---
    if (isDraftMode) {
      console.log("ChatScreen: Sending DRAFT_REPLY_REQUEST", { prompt: userMessage.text });
      chrome.runtime.sendMessage(
        { type: "DRAFT_REPLY_REQUEST", prompt: userMessage.text },
        (response) => {
          console.log("ChatScreen: DRAFT_REPLY_REQUEST acknowledged", response);
          if (chrome.runtime.lastError) {
            console.error("ChatScreen: Runtime error", chrome.runtime.lastError);
            const errorMessage: Message = {
              id: Date.now() + 1,
              sender: "ai",
              text: `Error: ${chrome.runtime.lastError.message}`,
            };
            setMessages((prev) => [...prev, errorMessage]);
            setIsRagLoading(false);
          }
        }
      );
      // We don't wait here, we wait for the message listener
      return;
    }

    try {
      // 🚀 STREAMING: Use SSE for real-time response
      // Create a placeholder AI message that will be updated
      const aiMessageId = Date.now() + 1;
      let accumulatedText = '';

      // Add placeholder message
      const placeholderMessage: Message = {
        id: aiMessageId,
        sender: "ai",
        text: "",  // Will be updated in real-time
      };
      setMessages((prev) => [...prev, placeholderMessage]);

      await askQuestionStream(
        prompt,
        isRagEnabled,
        // onStatus callback
        (status) => {
          setMessages((prev) => prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, text: `⏳ ${status}` } : msg
          ));
        },
        // onChunk callback - Update message with accumulated text
        (chunk) => {
          accumulatedText += chunk;
          setMessages((prev) => prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, text: accumulatedText } : msg
          ));
        },
        // onDone callback
        () => {
          // Final update and save to history
          const finalMessage: Message = {
            id: aiMessageId,
            sender: "ai",
            text: accumulatedText,
          };
          if (currentConversationId) {
            onAddMessage(currentConversationId, finalMessage);
          }
        },
        // onError callback
        (error) => {
          setMessages((prev) => prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, text: `Sorry, an error occurred: ${error}` } : msg
          ));
        }
      );
    } catch (err: any) {
      const errorMessage: Message = {
        id: Date.now() + 1,
        sender: "ai",
        text: `Sorry, an error occurred: ${err.message || "Please try again."}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsRagLoading(false);
    }
  };

  //-------------------------------------------------------------------------

  // --- Helper to save message to history using refs ---
  const saveMessageToHistory = (msg: Message) => {
    let convId = conversationIdRef.current;
    if (!convId) {
      // Create new conversation with this message
      convId = onCreateConversationRef.current(msg);
      onConversationChangeRef.current(convId);
      conversationIdRef.current = convId;
    } else {
      onAddMessageRef.current(convId, msg);
    }
  };

  // --- EFFECT TO LISTEN FOR CHROME MESSAGES ---
  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === "SUMMARY_LOADING") {
        // Handled locally by handleSummarizeClick
      } else if (message.type === "SUMMARY_RESULT") {
        const summaryMsg: Message = {
          id: Date.now(),
          sender: 'ai',
          text: "Summary Generated",
          type: 'summary',
          data: message.payload,
          isLoading: false
        };

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.type === 'summary' && lastMsg.isLoading) {
            return prev.map(msg => msg.id === lastMsg.id ? summaryMsg : msg);
          }
          return [...prev, summaryMsg];
        });

        // Save to history
        saveMessageToHistory(summaryMsg);

      } else if (message.type === "SUMMARY_ERROR") {
        const errorMsg: Message = {
          id: Date.now(),
          sender: 'ai',
          text: `Summary Failed: ${message.payload}`,
          type: 'summary',
          error: message.payload,
          isLoading: false
        };

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.type === 'summary' && lastMsg.isLoading) {
            return prev.map(msg => msg.id === lastMsg.id ? errorMsg : msg);
          }
          return [...prev, errorMsg];
        });

      } else if (message.type === "DRAFT_RESULT") {
        setIsRagLoading(false);
        const aiMessage: Message = {
          id: Date.now(),
          sender: "ai",
          text: message.payload,
        };
        setMessages((prev) => [...prev, aiMessage]);

        // Save to history
        saveMessageToHistory(aiMessage);

      } else if (message.type === "DRAFT_ERROR") {
        setIsRagLoading(false);
        const errorMessage: Message = {
          id: Date.now(),
          sender: "ai",
          text: `Sorry, could not draft reply: ${message.payload}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  // --- NEW HANDLER FOR THE BUTTON CLICK ---
  const handleSummarizeClick = () => {
    // Add a loading message
    const loadingMsg: Message = {
      id: Date.now(),
      sender: 'ai',
      text: "Summarizing...",
      type: 'summary',
      isLoading: true
    };
    setMessages(prev => [...prev, loadingMsg]);

    chrome.runtime.sendMessage(
      { type: "SUMMARIZE_CURRENT_EMAIL" },
      (response) => {
        if (chrome.runtime.lastError) {
          // Update loading message with error
          setMessages((prev) => prev.map(msg => msg.id === loadingMsg.id ? { ...msg, isLoading: false, error: chrome.runtime.lastError?.message || "Error" } : msg));
          return;
        }
        if (response.error) {
          setMessages((prev) => prev.map(msg => msg.id === loadingMsg.id ? { ...msg, isLoading: false, error: response.error } : msg));
        } else {
          // Success case is usually handled by the listener, but if response comes back here immediately:
          if (response.summary) {
            setMessages((prev) => prev.map(msg => msg.id === loadingMsg.id ? { ...msg, isLoading: false, data: response.summary } : msg));
          }
        }
      }
    );
  };

  const renderActiveView = () => {
    switch (activeView) {
      case "digest":
        return <DailyDigestView
          onClose={() => {
            setActiveView("none");
            setSelectedDate("");
          }}
          selectedDate={selectedDate}
          onDigestComplete={(digestData: any) => {
            // Add digest as a message in conversation
            const digestMsg: Message = {
              id: Date.now(),
              sender: 'ai',
              text: `Daily Digest${selectedDate ? ` for ${selectedDate}` : ''} generated`,
              type: 'digest',
              data: digestData
            };
            setMessages(prev => [...prev, digestMsg]);
            saveMessageToHistory(digestMsg);
          }}
        />;
      case "summarize":
        // Fallback if needed, but we are using inline messages now
        return <SummaryResultView onClose={() => setActiveView("none")} />;
      default:
        return null; // Render nothing if no view is active
    }
  };

  // auto complete
  const { suggestion, triggerAutocomplete, clearSuggestion, isLoading: isAutocompleteLoading } = useAutocomplete();

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Handle Autocomplete Trigger: Ctrl + A
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault(); // Prevent default "Select All"
      triggerAutocomplete(prompt);
      return;
    }

    // 2. Handle Tab to accept suggestion
    if (e.key === "Tab" && suggestion) {
      e.preventDefault(); // Prevent the default tab behavior
      setPrompt(prompt + suggestion); // Append the suggestion
      clearSuggestion(); // Clear the suggestion
      return;
    }

    // 3. Handle Enter to submit (optional, ensures standard behavior)
    if (e.key === 'Enter' && !e.shiftKey) {
      // e.preventDefault();
      // handleAskQuestionSubmit(e);
      // (Lets keep default form submission behavior for now or handle it if needed)
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const [textareaHeight, setTextareaHeight] = useState("auto");
  const [maxTextareaHeight, setMaxTextareaHeight] = useState(150);

  // Update max height based on window size
  useEffect(() => {
    const updateMaxHeight = () => {
      if (typeof window !== 'undefined') {
        if (window.innerWidth >= 1280) {
          setMaxTextareaHeight(200); // xl screens
        } else if (window.innerWidth >= 1024) {
          setMaxTextareaHeight(180); // lg screens
        } else {
          setMaxTextareaHeight(150); // default for smaller screens
        }
      }
    };

    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    return () => window.removeEventListener('resize', updateMaxHeight);
  }, []);

  useEffect(() => {
    if (textareaRef.current && ghostRef.current) {
      const ghost = ghostRef.current;
      const textarea = textareaRef.current;
      const maxHeight = maxTextareaHeight;

      // Reset heights before measuring to allow shrink
      ghost.style.height = "auto";
      textarea.style.height = "auto";

      // Measure ghost height based on content
      const ghostHeight = ghost.scrollHeight;
      const newHeight = Math.min(ghostHeight, maxHeight);

      // Apply new heights to both
      setTextareaHeight(`${newHeight}px`);
      ghost.style.height = `${newHeight}px`;
      textarea.style.height = `${newHeight}px`;

      // Toggle scroll behavior based on content height
      const shouldScroll = ghostHeight > maxHeight;
      textarea.style.overflowY = shouldScroll ? "auto" : "hidden";
      // Ghost should always be hidden to avoid double scrollbars, we sync via JS
      ghost.style.overflowY = "hidden";
    }
  }, [prompt, suggestion, maxTextareaHeight]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    // Clear suggestion if user types something new that invalidates it
    if (suggestion) clearSuggestion();
  };

  const handleScroll = () => {
    if (textareaRef.current && ghostRef.current) {
      ghostRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };


  const [isEnhancing, setIsEnhancing] = useState(false);
  const handleEnhance = async (type: 'formal' | 'concise' | 'casual' | 'clarity' | 'more') => {
    if (!prompt.trim()) return;
    setIsEnhancing(true);
    try {
      const enhancedText = await enhanceText(prompt, type);
      if (enhancedText) {
        setPrompt(enhancedText);
      }
    } catch (error) {
      console.error("Failed to enhance text", error);
    } finally {
      setIsEnhancing(false);
    }
  };


  return (
    <div className="flex h-screen flex-col bg-[#121212] text-white font-sans relative">
      <main className="flex-1 p-3 sm:p-4 lg:p-5 space-y-3 sm:space-y-4 lg:space-y-5 overflow-y-auto">

        <div className="flex w-full items-center justify-between">
          <div className="flex items-start gap-2.5 sm:gap-3 lg:gap-3">
            <img
              src="/logo.png"
              alt="Meeco Avatar"
              className="w-6 h-6 sm:w-7 sm:h-7 lg:w-7 lg:h-7 rounded-full flex-shrink-0"
            />

            <div className="max-w-[99%] rounded-lg px-3 sm:px-3.5 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm lg:text-base bg-[#171717] text-gray-100">
              <p className="whitespace-pre-wrap break-words">
                Hi! It's Mavin, How can I help today?
              </p>
            </div>
          </div>

          {/* New Chat Button */}
          {isLoggedIn && activeConversationId && (
            <button
              onClick={() => onConversationChange(null)}
              className="p-1.5 px-2.5 text-xs bg-[#262626] hover:bg-[#333] text-gray-300 rounded border border-[#333] transition-colors"
            >
              + New Chat
            </button>
          )}
        </div>

        <div ref={chatEndRef} />




        {/* Suggestion Buttons */}
        <div className="flex flex-col gap-2 sm:gap-2.5 lg:gap-3">
          {isLoggedIn && (
            <>
              <button
                onClick={() => {
                  setSelectedDate("");
                  setActiveView("digest");
                }}
                className="px-3 sm:px-3.5 lg:px-4 py-2 sm:py-2.5 bg-[#171717] hover:bg-[#262626] rounded-lg transition-colors text-xs sm:text-sm lg:text-base font-medium flex items-center gap-2 border border-[#262626] hover:border-[#22d3ee] w-full text-left"
              >
                <span className="text-[#22d3ee] text-xs sm:text-sm">✦</span> Summarize all emails I
                received today.
              </button>

              {/* Date Picker Button */}
              <div className="relative w-full" ref={datePickerRef}>
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="px-3 sm:px-3.5 lg:px-4 py-2 sm:py-2.5 bg-[#171717] hover:bg-[#262626] rounded-lg transition-colors text-xs sm:text-sm lg:text-base font-medium flex items-center gap-2 border border-[#262626] hover:border-[#22d3ee] w-full text-left"
                >
                  <span className="text-[#22d3ee] text-xs sm:text-sm">📅</span> Summarize emails by date
                </button>

                {showDatePicker && (
                  <div className="absolute top-full left-0 mt-2 z-50 bg-[#171717] border border-[#262626] rounded-lg p-3 shadow-lg w-full min-w-[280px]">
                    <div className="flex flex-col gap-3">
                      <label className="text-xs sm:text-sm text-gray-300 font-medium">
                        Select Date:
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="bg-[#121212] border border-[#262626] rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#22d3ee]"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (selectedDate) {
                              setActiveView("digest");
                              setShowDatePicker(false);
                            }
                          }}
                          disabled={!selectedDate}
                          className="flex-1 px-3 py-2 bg-[#22d3ee] hover:bg-[#1bbccf] disabled:bg-gray-600 disabled:cursor-not-allowed text-[#121212] rounded-lg text-xs sm:text-sm font-medium transition-colors"
                        >
                          Summarize
                        </button>
                        <button
                          onClick={() => {
                            setShowDatePicker(false);
                            setSelectedDate("");
                          }}
                          className="px-3 py-2 bg-[#262626] hover:bg-[#333] text-gray-300 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* <button className="px-3 sm:px-3.5 lg:px-4 py-2 sm:py-2.5 bg-[#171717] hover:bg-[#262626] rounded-lg transition-colors text-xs sm:text-sm lg:text-base font-medium flex items-center gap-2 border border-[#262626] hover:border-[#22d3ee] w-full text-left">
            <span className="text-[#22d3ee] text-xs sm:text-sm">✦</span> Write a professional
            apology email.
          </button> */}
          {/* --- REPLACE THE OLD BUTTON WITH THE NEW ONE --- */}
          {isLoggedIn && (
            <button
              onClick={handleSummarizeClick}
              className="px-3 sm:px-3.5 lg:px-4 py-2 sm:py-2.5 bg-[#171717] hover:bg-[#262626] rounded-lg transition-colors text-xs sm:text-sm lg:text-base font-medium flex items-center gap-2 border border-[#262626] hover:border-[#22d3ee] w-full text-left"
            >
              <span className="text-[#22d3ee] text-xs sm:text-sm">✦</span> Summarize the current
              email
            </button>
          )}
        </div>

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Active view (digest, summary) rendered AFTER messages for proper order */}
        {renderActiveView()}




        {isRagLoading && (
          <div className="flex items-start gap-2 sm:gap-2.5 lg:gap-3">
            <img
              src="/logo.png"
              alt="Meeco Avatar"
              className="w-5 h-5 sm:w-6 sm:h-6 lg:w-6 lg:h-6 xl:w-7 xl:h-7 rounded-full animate-pulse"
            />
            <div className="max-w-[85%] rounded-lg px-2.5 sm:px-3 lg:px-3.5 xl:px-4 py-1.5 sm:py-2 lg:py-2.5 xl:py-3 bg-[#171717]">
              <p className="text-[11px] sm:text-xs lg:text-sm xl:text-base text-gray-400 animate-pulse">
                {isRagEnabled ? "Searching your inbox..." : "Meeco is thinking..."}
              </p>
            </div>
          </div>
        )}



      </main>

      {/* --- FOOTER REMAINS THE SAME --- */}
      <footer className="p-3 sm:p-3.5 lg:p-4 xl:p-5 border-t border-[#262626] flex-shrink-0 space-y-2 sm:space-y-2.5 lg:space-y-3">


        <div className="relative w-full">
          <form onSubmit={handleAskQuestionSubmit} className="relative w-full bg-[#121212] border border-[#262626] rounded-xl focus-within:ring-1 focus-within:ring-[#22d3ee] transition-all">
            <div className="grid p-3">
              {/* Ghost suggestion layer */}
              <div
                ref={ghostRef}
                style={{
                  gridArea: "1 / 1 / 2 / 2",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowY: "hidden",
                  maxHeight: `${maxTextareaHeight}px`,
                  transition: "height 0.1s ease-out",
                }}
                className="w-full bg-transparent border-none p-0 text-[13px] sm:text-[14px] text-white font-normal leading-relaxed tracking-normal pointer-events-none"
              >
                <span className="text-white">{prompt + '\u200b'}</span>
                {suggestion && (
                  <span className="text-gray-500 opacity-60">{suggestion}</span>
                )}
              </div>

              {/* Actual textarea */}
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={handleInputChange}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                placeholder="Type or hold ^ control to speak"
                rows={1}
                style={{
                  gridArea: "1 / 1 / 2 / 2",
                  height: textareaHeight,
                  transition: "height 0.1s ease-out",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: `${maxTextareaHeight}px`,
                  overflowY: "auto",
                  resize: "none",
                  color: 'transparent',
                  caretColor: '#31B8C6',
                  textShadow: '0 0 0 transparent',
                }}
                className="z-10 w-full bg-transparent border-none p-0 text-[13px] sm:text-[14px] placeholder-gray-500 focus:outline-none focus:ring-0 resize-none font-normal leading-relaxed tracking-normal scrollbar-thin scrollbar-thumb-[#22d3ee]/40 scrollbar-track-transparent min-h-[24px]"
              />
            </div>

            {/* Toolbar */}
            <div className="flex justify-between items-center px-2 pb-2">
              <div className="flex-1 flex items-center gap-2">
                {/* RAG Toggle Button */}
                <Tooltip content={isRagEnabled ? "Search Inbox (RAG On)" : "Ask your Inbox"}>
                  <button
                    type="button"
                    onClick={() => setIsRagEnabled(!isRagEnabled)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all border ${isRagEnabled
                      ? "bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/30"
                      : "bg-transparent text-gray-500 border-transparent hover:bg-[#262626]"
                      }`}
                  >
                    <span className="text-lg">
                      {isRagEnabled ? "📄" : "🆇"}
                    </span>
                    <span className="text-[10px] font-medium hidden sm:inline-block">
                      {isRagEnabled ? "Ask Inbox" : "General"}
                    </span>
                  </button>
                </Tooltip>

                {/* Draft Reply Toggle Button */}
                <Tooltip content="Draft Reply">
                  <button
                    type="button"
                    onClick={() => setIsDraftMode(!isDraftMode)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all border ${isDraftMode
                      ? "bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/30"
                      : "bg-transparent text-gray-500 border-transparent hover:bg-[#262626]"
                      }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span className="text-[10px] font-medium hidden sm:inline-block">
                      Draft Reply
                    </span>
                  </button>
                </Tooltip>
              </div>

              <div className="flex items-center gap-2">
                {isLoggedIn && (
                  <EnhancementMenu onEnhance={handleEnhance} isLoading={isEnhancing} />
                )}
                <button
                  type="submit"
                  disabled={!prompt.trim() && !isRagLoading}
                  className={`p-1.5 rounded-lg transition-colors ${prompt.trim()
                    ? "bg-[#22d3ee] text-black hover:bg-[#1bbccf]"
                    : "bg-[#262626] text-gray-500 cursor-not-allowed"
                    }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </div>



        <div className="flex justify-between items-center">
          {isLoggedIn && (
            <div className="px-2 sm:px-2.5 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-lg text-[10px] sm:text-[11px] lg:text-xs xl:text-sm font-semibold text-[#22d3ee] border-1 border-[#22d3ee]/50 hover:bg-[#262626] hover:border-[#22d3ee]  ">
              <button>⚡️ 20 Updrage For More &gt;</button>
            </div>
          )}

          {/* Helper Hint */}
          {isLoggedIn && (
            <div className="flex justify-center mb-1">
              <div className="px-2 py-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded text-xs text-gray-500 flex items-center gap-2">
                <span className="bg-[#2A2A2A] rounded px-1 py-0.5 text-gray-300 font-mono text-[10px] sm:text-xs">Ctrl + A</span>
                <span>for AI Autocomplete</span>
              </div>
            </div>
          )}



        </div>
      </footer>
    </div>
  );
}

export default ChatScreen;