import { useState, useEffect } from "react";
import { createSupportTicket, getUserSupportTickets, SupportTicket } from "../services/api";
import { Loader2, CheckCircle, AlertCircle, Clock, XCircle } from "lucide-react";

export default function SupportScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [userTickets, setUserTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [showMyTickets, setShowMyTickets] = useState(false);

  const faqs = [
    {
      question: "How does On-Demand Thread Summarization work?",
      answer:
        "A 'Summarize' button appears on any email thread with more than 3 replies. Clicking it instantly generates a concise summary with key points and actions.",
    },
    {
      question: "What does the AI-Powered Writing Assistant do?",
      answer:
        "It improves tone, clarity, and structure. You can ask it to make your email more formal, concise, or professional.",
    },
    {
      question: "What is the Daily Digest feature?",
      answer:
        "It gives you a summary of important emails from the previous day, with highlights of urgent replies or key updates.",
    },
    {
      question: "How does Automated Triage & Labeling work?",
      answer:
        "It automatically categorizes emails into Focus, Review, or Archive, helping you maintain a clean, prioritized inbox.",
    },
    {
      question: "What is Agentic Search (Ask Your Inbox)?",
      answer:
        "You can search your entire inbox using natural language queries, like 'Find invoice from Figma last month'.",
    },
    {
      question: "Can I connect multiple Gmail accounts?",
      answer:
        "Yes. You can integrate multiple accounts and view them under a unified inbox.",
    },
    {
      question: "What are Custom User Instructions & Triggers?",
      answer:
        "You can automate tasks like sending daily summaries or auto-labeling invoices using a simple if-this-then-that rule builder.",
    },
    {
      question: "What is Smart Reply?",
      answer:
        "It suggests short, context-aware replies to emails, such as 'Thanks, I'll look into it' or 'Got it, will respond by EOD'.",
    },
  ];

  // Load user's tickets on mount
  useEffect(() => {
    loadUserTickets();
  }, []);

  const loadUserTickets = async () => {
    try {
      setLoadingTickets(true);
      const response = await getUserSupportTickets();
      setUserTickets(response.tickets || []);
    } catch (error) {
      console.error("Failed to load tickets:", error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createSupportTicket({ title, description, priority });
      setSubmitSuccess(true);
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");

      // Reload tickets
      loadUserTickets();

      // Close form after short delay
      setTimeout(() => {
        setShowTicketForm(false);
        setSubmitSuccess(false);
      }, 2000);
    } catch (error: any) {
      setSubmitError(error.message || "Failed to create ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Clock size={14} className="text-yellow-400" />;
      case "IN_PROGRESS":
        return <Loader2 size={14} className="text-blue-400 animate-spin" />;
      case "RESOLVED":
        return <CheckCircle size={14} className="text-green-400" />;
      case "CLOSED":
        return <XCircle size={14} className="text-gray-400" />;
      default:
        return <AlertCircle size={14} className="text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "LOW":
        return "text-gray-400";
      case "MEDIUM":
        return "text-yellow-400";
      case "HIGH":
        return "text-orange-400";
      case "URGENT":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="flex h-screen bg-[#121212] text-white overflow-hidden">
      {/* Scrollable content area only */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold mb-4">Support</h1>
          <p className="text-sm text-gray-400 mb-6">
            Find answers to common questions or create a support ticket below.
          </p>

          {/* Toggle between FAQ and My Tickets */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setShowMyTickets(false)}
              className={`px-4 py-2 text-sm rounded-lg transition ${!showMyTickets
                  ? "bg-[#22d3ee] text-[#121212] font-semibold"
                  : "bg-[#171717] text-gray-400 hover:text-white"
                }`}
            >
              FAQ
            </button>
            <button
              onClick={() => setShowMyTickets(true)}
              className={`px-4 py-2 text-sm rounded-lg transition ${showMyTickets
                  ? "bg-[#22d3ee] text-[#121212] font-semibold"
                  : "bg-[#171717] text-gray-400 hover:text-white"
                }`}
            >
              My Tickets ({userTickets.length})
            </button>
          </div>

          {!showMyTickets ? (
            <>
              {/* FAQ Section */}
              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <div
                    key={index}
                    className="bg-[#171717] rounded-xl border border-[#262626]"
                  >
                    <button
                      onClick={() =>
                        setOpenIndex(openIndex === index ? null : index)
                      }
                      className="w-full flex justify-between items-center p-4 text-left text-sm font-medium text-gray-200 hover:text-white"
                    >
                      <span>{faq.question}</span>
                      <span className="text-gray-400">
                        {openIndex === index ? "−" : "+"}
                      </span>
                    </button>
                    {openIndex === index && (
                      <div className="px-4 pb-4 text-gray-400 text-sm">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* My Tickets Section */
            <div className="space-y-3">
              {loadingTickets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-[#22d3ee]" size={24} />
                </div>
              ) : userTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>You haven't created any support tickets yet.</p>
                </div>
              ) : (
                userTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-[#171717] rounded-xl border border-[#262626] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(ticket.status)}
                          <h3 className="text-sm font-medium text-white">
                            {ticket.title}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                          {ticket.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs">
                          <span className={getPriorityColor(ticket.priority)}>
                            {ticket.priority}
                          </span>
                          <span className="text-gray-500">
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-[#262626] text-gray-400">
                        {ticket.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Contact and Ticket Section */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">
              Still need help? Contact us or create a support ticket below.
            </p>
            <div className="mt-4 flex justify-center gap-4">
              <button
                onClick={() => (window.location.href = "mailto:support@meeco.ai")}
                className="px-4 py-2 bg-[#22d3ee] text-sm rounded-lg hover:bg-[#1bbccf] transition text-[#121212] font-semibold"
              >
                Contact Us
              </button>
              <button
                onClick={() => setShowTicketForm(true)}
                className="px-4 py-2 bg-[#171717] border border-[#22d3ee]/30 text-sm rounded-lg hover:bg-[#22d3ee]/10 text-[#22d3ee] transition"
              >
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Popup Modal for Create Ticket */}
      {showTicketForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#171717] rounded-2xl p-6 w-full max-w-md border border-[#262626]">
            <h2 className="text-lg font-semibold mb-2">Create Support Ticket</h2>
            <p className="text-sm text-gray-400 mb-4">
              Describe your issue below and our team will get back to you soon.
            </p>

            {submitSuccess ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle className="text-green-400 mb-3" size={48} />
                <p className="text-green-400 font-medium">Ticket Created Successfully!</p>
                <p className="text-sm text-gray-400 mt-1">We'll get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300">Issue Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter a short title"
                    className="w-full mt-1 p-2 text-sm rounded-md bg-[#121212] border border-[#333] text-gray-200 outline-none focus:border-[#22d3ee]"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300">Description</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Describe your issue"
                    className="w-full mt-1 p-2 text-sm rounded-md bg-[#121212] border border-[#333] text-gray-200 outline-none resize-none focus:border-[#22d3ee]"
                  ></textarea>
                </div>
                <div>
                  <label className="text-sm text-gray-300">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full mt-1 p-2 text-sm rounded-md bg-[#121212] border border-[#333] text-gray-200 outline-none focus:border-[#22d3ee]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {submitError}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTicketForm(false);
                      setSubmitError(null);
                    }}
                    className="px-4 py-2 text-sm bg-[#262626] rounded-lg hover:bg-[#333] text-white"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm bg-[#22d3ee] rounded-lg hover:bg-[#1bbccf] text-[#121212] font-semibold flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
