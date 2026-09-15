"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendMessage, markConversationRead, fetchMessages } from "@/app/(app)/messages/actions";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format-datetime";
import { personDisplayName } from "@/components/ui/person-label";
import type { MessageItem, ParticipantReadState } from "@/lib/messaging-queries";

// Kept as a fallback safety net (connection drops, a missed event) — the
// real delivery mechanism is the Realtime broadcast below, not this timer.
const FALLBACK_POLL_INTERVAL_MS = 20000;

export function MessageThread({
  conversationId,
  initialMessages,
  initialOtherParticipants,
  myProfileId,
  isGroup,
}: {
  conversationId: string;
  initialMessages: MessageItem[];
  initialOtherParticipants: ParticipantReadState[];
  myProfileId: string;
  isGroup: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [otherParticipants, setOtherParticipants] = useState(initialOtherParticipants);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Instant delivery via Realtime Broadcast (0033_messaging_realtime.sql) —
  // the channel only ever carries a {conversation_id, message_id} pointer,
  // never message content, since content is encrypted server-side and the
  // key never reaches the browser. Receiving a ping just triggers the same
  // decrypt-on-the-server fetchMessages() call the initial page load uses.
  // The interval below is a fallback, not the primary delivery path — in
  // case the socket drops or an event is missed, the thread still catches
  // up within FALLBACK_POLL_INTERVAL_MS.
  useEffect(() => {
    markConversationRead(conversationId);

    const supabase = createClient();
    const channel = supabase.channel(`conversation:${conversationId}`, { config: { private: true } });
    channel
      .on("broadcast", { event: "new_message" }, async () => {
        const fresh = await fetchMessages(conversationId);
        setMessages(fresh.messages);
        setOtherParticipants(fresh.otherParticipants);
        markConversationRead(conversationId);
      })
      .subscribe();

    // The other participant's "Seen" state only updates when someone
    // actually re-fetches — there's no broadcast for "read," just for new
    // messages — so this poll is also what keeps the Seen indicator
    // reasonably current, not only a delivery fallback.
    const interval = setInterval(async () => {
      const fresh = await fetchMessages(conversationId);
      setMessages(fresh.messages);
      setOtherParticipants(fresh.otherParticipants);
    }, FALLBACK_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await sendMessage(conversationId, trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setValue("");
      const fresh = await fetchMessages(conversationId);
      setMessages(fresh.messages);
      setOtherParticipants(fresh.otherParticipants);
    });
  }

  // "Seen" only ever annotates the last message in the thread, and only
  // when that message is mine — matching how most chat apps show read
  // receipts (on your own latest bubble, not on every message you've sent).
  const lastMessage = messages[messages.length - 1];
  const lastMessageIsMine = lastMessage?.senderId === myProfileId;
  const seenBy = lastMessageIsMine
    ? otherParticipants.filter((p) => p.lastReadAt && p.lastReadAt >= lastMessage.createdAt)
    : [];

  function seenLabel(): string | null {
    if (!lastMessageIsMine || otherParticipants.length === 0 || seenBy.length === 0) return null;
    if (!isGroup) return "Seen";
    if (seenBy.length === otherParticipants.length) return "Seen by all";
    return `Seen by ${seenBy.map((p) => (p.profile ? personDisplayName(p.profile) : "someone")).join(", ")}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-[60vh] min-h-[16rem] flex-col gap-2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-zinc-500 dark:text-zinc-400">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === myProfileId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                    mine
                      ? "bg-brand text-white dark:bg-brand dark:text-white"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {!mine && (
                    <p className="mb-0.5 text-xs font-medium opacity-70">{personDisplayName(m.sender)}</p>
                  )}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
                <p className="mt-0.5 text-[0.65rem] text-zinc-400">
                  {formatDateTime(m.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {m.id === lastMessage.id && seenLabel() && <> · {seenLabel()}</>}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Message…"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          disabled={pending || !value.trim()}
          onClick={submit}
          className="self-end rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-60 dark:bg-brand dark:text-white"
        >
          Send
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
