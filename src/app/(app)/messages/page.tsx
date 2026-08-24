import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getConversations } from "@/lib/messaging-queries";
import { getProfiles } from "@/lib/queries";
import { EmptyState } from "@/components/ui/card";
import { NewConversationButton } from "@/components/messages/new-conversation-button";
import { formatDateTime } from "@/lib/format-datetime";
import { personDisplayName } from "@/components/ui/person-label";

export default async function MessagesPage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");

  const [conversations, allProfiles] = await Promise.all([getConversations(), getProfiles()]);
  const pickablePeople = allProfiles.filter((p) => p.id !== current.profile.id && !p.deactivated_at);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Messages</h1>
        <NewConversationButton people={pickablePeople} />
      </div>

      {conversations.length === 0 ? (
        <EmptyState>
          <p>No conversations yet.</p>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {conversations.map((c) => {
            const title = c.isGroup
              ? (c.name ?? c.otherParticipants.map((p) => personDisplayName(p)).join(", "))
              : (c.otherParticipants[0] ? personDisplayName(c.otherParticipants[0]) : "Unknown");
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-3 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {title}
                      {c.isGroup && (
                        <span className="ml-1.5 text-xs font-normal text-zinc-400">
                          ({c.otherParticipants.length + 1})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDateTime(c.lastMessageAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
