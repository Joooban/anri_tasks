"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";
import { friendlyError } from "@/lib/friendly-error";
import { nullableRpcArg } from "@/lib/rpc-utils";
import { getConversationMessages, type ConversationMessagesResult } from "@/lib/messaging-queries";

// Client-callable wrapper so the thread's polling loop (message content is
// decrypted server-side, so the client can't query Supabase directly the
// way it does for non-sensitive data) can re-fetch on an interval.
export async function fetchMessages(conversationId: string): Promise<ConversationMessagesResult> {
  return getConversationMessages(conversationId);
}

export async function createConversation(participantIds: string[], isGroup: boolean, name: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_conversation_rpc", {
    p_participant_ids: participantIds,
    p_is_group: isGroup,
    p_name: nullableRpcArg(name),
  });

  if (error || !data) return { error: friendlyError(error, "We couldn't start that conversation"), conversationId: null };
  revalidatePath("/messages");
  return { error: null, conversationId: data as string };
}

export async function sendMessage(conversationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Message can't be empty." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_message_rpc", {
    p_conversation_id: conversationId,
    p_body: encrypt(trimmed),
  });

  if (error) return { error: friendlyError(error, "We couldn't send that message") };
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { error: null };
}

export async function markConversationRead(conversationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_read_rpc", { p_conversation_id: conversationId });
  if (error) return { error: friendlyError(error, "We couldn't update that") };
  revalidatePath("/messages");
  return { error: null };
}
