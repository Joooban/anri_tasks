"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";
import { revalidateTaskRelatedPaths } from "@/lib/revalidate-task-paths";

// Marks the caller's active step done — or, if the step requires the next
// assignee's confirmation, moves it to 'pending_approval' instead. The
// relay-advance trigger (0002_functions_triggers.sql) fires on the RPC's
// internal UPDATE the same as it would on a client-side one. See
// 0015_relay_action_rpcs.sql for why this runs as an RPC rather than a
// plain RLS-gated update.
export async function completeStep(taskId: string, assigneeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_step_rpc", { p_assignee_id: assigneeId });
  if (error) return { error: friendlyError(error, "We couldn't update that step") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function confirmStep(taskId: string, assigneeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_step_rpc", { p_assignee_id: assigneeId });
  if (error) return { error: friendlyError(error, "We couldn't confirm that step") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function blockStep(taskId: string, assigneeId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_step_rpc", { p_assignee_id: assigneeId, p_notes: notes || null });
  if (error) return { error: friendlyError(error, "We couldn't mark that step blocked") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function unblockStep(taskId: string, assigneeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unblock_step_rpc", { p_assignee_id: assigneeId });
  if (error) return { error: friendlyError(error, "We couldn't resume that step") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function cancelTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_task_rpc", { p_task_id: taskId });
  if (error) return { error: friendlyError(error, "We couldn't cancel the task") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function addComment(taskId: string, body: string) {
  if (!body.trim()) return { error: "Comment can't be empty." };
  const supabase = await createClient();
  const { data: commentId, error } = await supabase.rpc("add_task_comment_rpc", {
    p_task_id: taskId,
    p_body: body.trim(),
  });
  if (error || !commentId) return { error: friendlyError(error, "We couldn't post your comment") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function getAttachmentUrl(storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("task-attachments")
    .createSignedUrl(storagePath, 60 * 5);
  if (error || !data) return null;
  return data.signedUrl;
}
