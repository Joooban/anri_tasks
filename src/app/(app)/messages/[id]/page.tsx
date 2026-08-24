import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getConversationMessages } from "@/lib/messaging-queries";
import { MessageThread } from "@/components/messages/message-thread";
import type { ConversationParticipant } from "@/lib/messaging-queries";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) redirect("/login");

  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,is_group,name,conversation_participants(profile_id,profile:profiles(id,full_name,email))")
    .eq("id", id)
    .maybeSingle();

  // Same shape either way (doesn't exist vs. exists but you're not a
  // participant) — RLS scopes this select to participants only, and
  // there's no reason to distinguish the two for a private DM/group chat
  // the way task detail pages do for shared links.
  if (!conversation) notFound();

  const messages = await getConversationMessages(id);

  const participants = (conversation.conversation_participants ?? []) as unknown as Array<{
    profile_id: string;
    profile: ConversationParticipant | null;
  }>;
  const others = participants
    .filter((p) => p.profile_id !== current.profile.id)
    .map((p) => p.profile)
    .filter((p): p is ConversationParticipant => p !== null);
  const title = conversation.is_group
    ? (conversation.name ?? others.map((p) => p.full_name || p.email).join(", "))
    : others[0]?.full_name || others[0]?.email || "Unknown";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Link href="/messages" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← Messages
        </Link>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
      </div>
      <MessageThread conversationId={id} initialMessages={messages} myProfileId={current.profile.id} />
    </div>
  );
}
