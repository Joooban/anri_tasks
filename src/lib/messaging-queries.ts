import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";

export interface ConversationParticipant {
  id: string;
  full_name: string | null;
  email: string;
  nickname: string | null;
}

export interface ConversationListItem {
  id: string;
  isGroup: boolean;
  name: string | null;
  lastMessageAt: string;
  otherParticipants: ConversationParticipant[];
  unread: boolean;
  lastMessage: string | null;
}

// Ordered by most recent activity. "Unread" compares last_message_at
// against this viewer's own last_read_at (null = never read) — see
// send_message_rpc/mark_conversation_read_rpc, 0032_messaging.sql.
export async function getConversations(): Promise<ConversationListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("conversations")
    .select(
      "id,is_group,name,last_message_at,conversation_participants(profile_id,last_read_at,profile:profiles(id,full_name,email,nickname))"
    )
    .order("last_message_at", { ascending: false });

  const conversationIds = (data ?? []).map((c) => c.id);
  // Latest message body per conversation, for the list preview — decrypted
  // server-side same as everywhere else message content is shown. No
  // per-row "latest" query in Postgres without a view, so this fetches
  // every message for these conversations, sorted, and keeps the first
  // (most recent) one per conversation in JS.
  const lastMessageByConversation = new Map<string, string>();
  if (conversationIds.length > 0) {
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("conversation_id,body,created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });
    for (const m of recentMessages ?? []) {
      if (!lastMessageByConversation.has(m.conversation_id)) {
        lastMessageByConversation.set(m.conversation_id, decrypt(m.body));
      }
    }
  }

  return (data ?? []).map((c) => {
    const participants = (c.conversation_participants ?? []) as unknown as Array<{
      profile_id: string;
      last_read_at: string | null;
      profile: ConversationParticipant | null;
    }>;
    const mine = participants.find((p) => p.profile_id === user.id);
    const others = participants
      .filter((p) => p.profile_id !== user.id)
      .map((p) => p.profile)
      .filter((p): p is ConversationParticipant => p !== null);
    const unread = !mine?.last_read_at || mine.last_read_at < c.last_message_at;

    return {
      id: c.id,
      isGroup: c.is_group,
      name: c.name,
      lastMessageAt: c.last_message_at,
      otherParticipants: others,
      unread,
      lastMessage: lastMessageByConversation.get(c.id) ?? null,
    };
  });
}

export interface MessageItem {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: ConversationParticipant | null;
}

export async function getConversationMessages(conversationId: string): Promise<MessageItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id,sender_id,body,created_at,sender:profiles(id,full_name,email,nickname)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as unknown as Array<{
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
    sender: ConversationParticipant | null;
  }>).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    body: decrypt(m.body),
    createdAt: m.created_at,
    sender: m.sender,
  }));
}

export async function getUnreadMessageCount(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_unread_message_count_rpc");
  return data ?? 0;
}
