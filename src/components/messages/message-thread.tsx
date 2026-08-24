"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendMessage, markConversationRead, fetchMessages } from "@/app/(app)/messages/actions";
import { formatDateTime } from "@/lib/format-datetime";
import type { MessageItem } from "@/lib/messaging-queries";

const POLL_INTERVAL_MS = 4000;

export function MessageThread({
  conversationId,
  initialMessages,
  myProfileId,
}: {
  conversationId: string;
  initialMessages: MessageItem[];
  myProfileId: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // No push-realtime here (message bodies are encrypted server-side —
  // see 0032_messaging.sql for why raw Postgres realtime doesn't work for
  // this) — a lightweight poll instead, same decrypt-on-the-server path as
  // the initial page load.
  useEffect(() => {
    markConversationRead(conversationId);
    const interval = setInterval(async () => {
      const fresh = await fetchMessages(conversationId);
      setMessages(fresh);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
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
      setMessages(fresh);
    });
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
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {!mine && (
                    <p className="mb-0.5 text-xs font-medium opacity-70">{m.sender?.full_name || m.sender?.email}</p>
                  )}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
                <p className="mt-0.5 text-[0.65rem] text-zinc-400">
                  {formatDateTime(m.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
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
          className="self-end rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
