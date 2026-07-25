import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TelegramInlineButtonSetup({ api }) {
  const [info, setInfo] = useState(null);
  const [baseUrl, setBaseUrl] = useState("https://creativestore.my.id");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/telegram/webhook-info");
      setInfo(r.data?.result || r.data);
    } catch (e) {
      // ignore
    } finally { setLoading(false); }
  };

  useEffect(() => { loadInfo(); }, []);

  const register = async () => {
    if (!baseUrl.startsWith("https://")) {
      toast.error("URL harus HTTPS (contoh: https://creativestore.my.id)");
      return;
    }
    setBusy(true);
    try {
      const r = await api.post("/admin/telegram/setup-admin-webhook", { base_url: baseUrl });
      if (r.data.ok) {
        toast.success("Webhook admin bot terpasang ✅");
      } else {
        toast.error("Setup gagal: " + JSON.stringify(r.data.telegram_response));
      }
      loadInfo();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal setup webhook");
    } finally { setBusy(false); }
  };

  const currentUrl = info?.url || "";
  const isRegistered = !!currentUrl;

  return (
    <div className="rounded-lg bg-[#0f1117] border border-white/10 p-3 space-y-3" data-testid="telegram-webhook-setup">
      <div>
        <Label className="text-sm">Inline Button Notifikasi Order (Telegram Admin)</Label>
        <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
          Aktifkan tombol Konfirmasi/Batalkan langsung dari notifikasi Telegram admin. <b>Setup satu kali per environment</b> — jalankan hanya dari <b>PRODUCTION</b>, jangan dari preview.
        </p>
      </div>

      {loading ? (
        <div className="text-xs text-white/50 flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Cek status webhook...
        </div>
      ) : (
        <div className={`text-xs rounded-md px-3 py-2 flex items-start gap-2 ${
          isRegistered
            ? "bg-green-500/10 border border-green-500/30 text-green-200"
            : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-200"
        }`}>
          {isRegistered ? <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />}
          <div className="min-w-0 flex-1">
            <div className="font-medium">{isRegistered ? "Webhook terpasang" : "Belum ada webhook"}</div>
            {isRegistered && (
              <div className="text-[10px] text-white/60 truncate font-mono mt-0.5" title={currentUrl}>
                {currentUrl}
              </div>
            )}
            {info?.pending_update_count > 0 && (
              <div className="text-[10px] text-yellow-300 mt-0.5">Pending updates: {info.pending_update_count}</div>
            )}
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs">Base URL Backend</Label>
        <Input
          data-testid="webhook-base-url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://creativestore.my.id"
          className="bg-[#1a1d27] border-white/15 mt-1 text-sm"
        />
        <p className="text-[10px] text-white/40 mt-1">
          Endpoint yang akan didaftarkan: <code>{baseUrl.replace(/\/$/, "")}/api/telegram/admin-webhook</code>
        </p>
      </div>

      <Button
        data-testid="setup-webhook-btn"
        onClick={register}
        disabled={busy || !baseUrl}
        className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold w-full"
      >
        {busy ? <Loader2 className="animate-spin mr-2" size={14} /> : <Send size={14} className="mr-2" />}
        {isRegistered ? "Re-register Webhook" : "Setup Webhook Sekarang"}
      </Button>
    </div>
  );
}
