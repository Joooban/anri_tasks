import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getConversationMessages } from "@/lib/messaging-queries";
import { MessageThread } from "@/components/messages/message-thread";
import { personDisplayName } from "@/components/ui/person-label";
import type { ConversationParticipant } from "@/lib/messaging-queries";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) redirect("/login");

  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,is_group,name,conversation_participants(profile_id,profile:profiles(id,full_name,email,nickname))")
    .eq("id", id)
    .maybeSingle();

  // Same shape either way (doesn't exist vs. exists but you're not a
  // participant) — RLS scopes this select to participants only, and
  // there's no reason to distinguish the two for a private DM/group chat
  // the way task detail pages do for shared links.
  if (!conversation) notFound();

  const { messages, otherParticipants } = await getConversationMessages(id);

  const participants = (conversation.conversation_participants ?? []) as unknown as Array<{
    profile_id: string;
    profile: ConversationParticipant | null;
  }>;
  const others = participants
    .filter((p) => p.profile_id !== current.profile.id)
    .map((p) => p.profile)
    .filter((p): p is ConversationParticipant => p !== null);
  const title = conversation.is_group
    ? (conversation.name ?? others.map((p) => personDisplayName(p)).join(", "))
    : others[0]
      ? personDisplayName(others[0])
      : "Unknown";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Link href="/messages" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← Messages
        </Link>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
        {conversation.is_group && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Members: You, {others.map((p) => personDisplayName(p)).join(", ")}
          </p>
        )}
      </div>
      <MessageThread
        conversationId={id}
        initialMessages={messages}
        initialOtherParticipants={otherParticipants}
        myProfileId={current.profile.id}
        isGroup={conversation.is_group}
      />
    </div>
  );
}
