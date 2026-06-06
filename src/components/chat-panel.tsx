import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  id: string;
  text: string;
  source: "voice" | "chat";
  participantId: string | null;
  authorName: string;
  authorColor: string;
  t: number;
};

type ParticipantLite = {
  id: string;
  display_name: string;
  color: string | null;
  input_mode: "voice" | "chat" | "both";
  linked_participant_id: string | null;
};

export function ChatPanel({
  roomId,
  selfParticipantId,
  selfName,
  selfColor,
  onChatMessage,
}: {
  roomId: string;
  selfParticipantId: string | null;
  selfName: string;
  selfColor: string;
  /** Called when this user sends a chat message — caller forwards to AI draw. */
  onChatMessage: (text: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Record<string, ParticipantLite>>({});
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build display name + color for a participant, following identity links to canonical row.
  const resolveAuthor = useCallback((pid: string | null): { name: string; color: string; modes: Set<string> } => {
    if (!pid) return { name: "Cartoonist", color: "#999", modes: new Set() };
    let cur = participants[pid];
    if (!cur) return { name: "Someone", color: "#999", modes: new Set() };
    // Follow link chain to canonical (max 3 hops)
    let hops = 0;
    while (cur.linked_participant_id && participants[cur.linked_participant_id] && hops < 3) {
      cur = participants[cur.linked_participant_id];
      hops++;
    }
    const modes = new Set<string>([cur.input_mode]);
    // include modes from linked siblings pointing back at this canonical row
    Object.values(participants).forEach((p) => {
      if (p.linked_participant_id === cur.id) modes.add(p.input_mode);
    });
    if (cur.input_mode === "both") {
      modes.add("voice");
      modes.add("chat");
    }
    return { name: cur.display_name, color: cur.color ?? "#666", modes };
  }, [participants]);

  // Initial load + realtime subscribe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: parts }, { data: chunks }] = await Promise.all([
        supabase.from("participants").select("id,display_name,color,input_mode,linked_participant_id").eq("room_id", roomId),
        supabase.from("transcript_chunks").select("id,text,source,participant_id,t_offset_ms,created_at").eq("room_id", roomId).order("created_at", { ascending: true }).limit(200),
      ]);
      if (cancelled) return;
      const pmap: Record<string, ParticipantLite> = {};
      (parts ?? []).forEach((p) => {
        const row = p as unknown as ParticipantLite;
        pmap[row.id] = row;
      });
      setParticipants(pmap);
      const msgs: ChatMessage[] = (chunks ?? []).map((c) => {
        const row = c as unknown as { id: string; text: string; source: "voice"|"chat"|null; participant_id: string|null; t_offset_ms: number; created_at: string };
        return {
          id: row.id,
          text: row.text,
          source: (row.source ?? "voice") as "voice" | "chat",
          participantId: row.participant_id,
          authorName: row.participant_id && pmap[row.participant_id]?.display_name || "Someone",
          authorColor: row.participant_id && pmap[row.participant_id]?.color || "#666",
          t: new Date(row.created_at).getTime(),
        };
      });
      setMessages(msgs);
    })();

    const ch = supabase.channel(`chat:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transcript_chunks", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { id: string; text: string; source: "voice"|"chat"|null; participant_id: string|null; created_at: string };
          setMessages((cur) => cur.find((m) => m.id === row.id) ? cur : [...cur, {
            id: row.id,
            text: row.text,
            source: (row.source ?? "voice") as "voice" | "chat",
            participantId: row.participant_id,
            authorName: "",  // resolved at render time
            authorColor: "",
            t: new Date(row.created_at).getTime(),
          }]);
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as ParticipantLite | null;
          const old = payload.old as { id: string } | null;
          setParticipants((cur) => {
            const next = { ...cur };
            if (payload.eventType === "DELETE" && old) {
              delete next[old.id];
            } else if (row) {
              next[row.id] = row;
            }
            return next;
          });
        })
      .subscribe();

    return () => { cancelled = true; void supabase.removeChannel(ch); };
  }, [roomId]);

  // Auto-scroll on new message
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = useCallback(async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    const t_offset = Date.now();
    // Optimistic
    const tempId = `tmp_${t_offset}`;
    setMessages((cur) => [...cur, {
      id: tempId, text: t, source: "chat", participantId: selfParticipantId,
      authorName: selfName, authorColor: selfColor, t: t_offset,
    }]);
    const { data } = await supabase.from("transcript_chunks").insert({
      room_id: roomId,
      text: t,
      source: "chat",
      participant_id: selfParticipantId,
      t_offset_ms: 0,
    } as never).select("id").maybeSingle();
    // Replace temp with real id if returned
    if (data?.id) {
      setMessages((cur) => cur.map((m) => m.id === tempId ? { ...m, id: data.id } : m));
    }
    onChatMessage(t);
  }, [text, roomId, selfParticipantId, selfName, selfColor, onChatMessage]);

  const rendered = useMemo(() => messages.map((m) => {
    const a = resolveAuthor(m.participantId);
    return { ...m, authorName: a.name, authorColor: a.color, modes: a.modes };
  }), [messages, resolveAuthor]);

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="eyebrow text-foreground">Stream</span>
        <span className="eyebrow text-muted-foreground" data-numeric>{rendered.length}</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {rendered.length === 0 && (
          <p className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
            Voice utterances and chat messages will appear here together.
          </p>
        )}
        {rendered.map((m) => (
          <div key={m.id} className="flex gap-2">
            <div className="mt-0.5 h-5 w-5 shrink-0 flex items-center justify-center font-medium uppercase text-background"
              style={{ backgroundColor: m.authorColor, fontSize: "var(--step-0)" }}>
              {(m.authorName || "?").slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-medium text-foreground" style={{ fontSize: "var(--step-0)" }}>
                  {m.authorName || "Someone"}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  {m.source === "voice" ? <Mic className="h-2.5 w-2.5" /> : <MessageSquare className="h-2.5 w-2.5" />}
                </span>
              </div>
              <p className="break-words text-foreground/90" style={{ fontSize: "var(--step-1)", lineHeight: 1.4 }}>
                {m.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="border-t border-border bg-background p-2"
      >
        <div className="flex items-end gap-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Type to the room…"
            rows={2}
            className="flex-1 resize-none border border-border bg-background px-2 py-1.5 text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontSize: "var(--step-1)" }}
          />
          <button type="submit" disabled={!text.trim()} className="h-8 border border-border bg-foreground px-2 text-background disabled:opacity-30">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
