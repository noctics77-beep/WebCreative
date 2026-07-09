import { useEffect, useRef, useState } from "react";
import { api, API } from "@/lib/api";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import axios from "axios";

const AVATAR_SVG = (
  <svg viewBox="0 0 40 40" className="w-9 h-9">
    <defs>
      <linearGradient id="ava" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F5A623" />
        <stop offset="100%" stopColor="#7a4a0e" />
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="20" fill="url(#ava)" />
    <circle cx="14" cy="17" r="2" fill="#0f1117" />
    <circle cx="26" cy="17" r="2" fill="#0f1117" />
    <path d="M13 25 Q20 30 27 25" stroke="#0f1117" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

const INITIAL = {
  role: "assistant",
  text: "Halo! Ada yang bisa dibantu seputar produk atau cara order di CreativeStore? 😊",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/chat`, { message: text, session_id: sessionId });
      if (res.data.session_id) setSessionId(res.data.session_id);
      setMessages((m) => [...m, { role: "assistant", text: res.data.reply }]);
    } catch (err) {
      const detail = err?.response?.data?.detail || "Maaf, ada gangguan. Coba lagi sebentar.";
      setMessages((m) => [...m, { role: "assistant", text: detail }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <div
          data-testid="chat-toggle-wrap"
          onClick={() => setOpen(true)}
          className="fixed bottom-3 right-3 z-[2147483647] flex items-center gap-2 bg-[#1a1d27]/95 backdrop-blur-md border border-white/10 h-12 pl-4 pr-1 rounded-full shadow-2xl cursor-pointer min-w-[220px] hover:bg-[#22262f] transition-colors"
        >
          <Sparkles size={14} className="text-[#F5A623] flex-shrink-0" />
          <span className="text-[13px] text-white/85 font-medium flex-1 select-none">Tanya CS · Chat kami</span>
          <button
            data-testid="chat-toggle-btn"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            className="w-10 h-10 rounded-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] shadow-lg gold-glow flex items-center justify-center transition-transform hover:scale-105 flex-shrink-0"
            aria-label="Buka chat"
          >
            <MessageCircle size={20} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {open && (
        <div
          data-testid="chat-widget"
          className="fixed bottom-3 right-3 z-[2147483647] w-[calc(100vw-1.5rem)] sm:w-[380px] h-[540px] max-h-[80vh] bg-[#1a1d27] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 p-3 border-b border-white/5 bg-[#0f1117]">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                {AVATAR_SVG}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#34d399] rounded-full border-2 border-[#0f1117]" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-medium text-white">Asisten CreativeStore</div>
                <div className="text-[11px] text-[#34d399] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#34d399] rounded-full" /> Online
                </div>
              </div>
            </div>
            <button
              data-testid="chat-close-btn"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md text-white/60 hover:bg-white/5 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            data-testid="chat-messages"
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                    m.role === "user"
                      ? "bg-[#F5A623] text-[#0f1117] rounded-br-sm"
                      : "bg-white/[0.06] text-white/90 rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.06] px-3 py-2 rounded-2xl flex items-center gap-2 text-white/60 text-sm">
                  <Loader2 className="animate-spin" size={14} /> mengetik...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={send} className="p-3 border-t border-white/5 flex items-center gap-2">
            <input
              data-testid="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik pertanyaan kamu..."
              className="flex-1 bg-[#0f1117] border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#F5A623]/50"
              disabled={loading}
            />
            <button
              type="submit"
              data-testid="chat-send-btn"
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-full bg-[#F5A623] hover:bg-[#d98f1a] disabled:bg-white/10 disabled:text-white/30 text-[#0f1117] flex items-center justify-center transition"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
