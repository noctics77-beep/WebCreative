import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users } from "lucide-react";

export default function OnlineCounter() {
  const [base, setBase] = useState(50);
  const [n, setN] = useState(50);

  useEffect(() => {
    api.get("/stats").then((r) => {
      const b = parseInt(r.data.online_base, 10) || 50;
      setBase(b);
      setN(b + Math.floor(Math.random() * 15) - 7);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const delta = Math.floor(Math.random() * 11) - 5; // -5..+5
      const next = Math.max(5, base + delta);
      setN(next);
    }, 4000);
    return () => clearInterval(t);
  }, [base]);

  return (
    <div
      data-testid="online-counter"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/30 text-[#34d399] text-xs font-medium"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34d399]"></span>
      </span>
      <Users size={12} />
      <span><b className="text-white">{n}</b> orang sedang berbelanja sekarang</span>
    </div>
  );
}
