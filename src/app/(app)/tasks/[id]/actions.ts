"use server";

import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";
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

// For the one case where requires_confirmation was set on what turned out
// to be the last step in the chain — no next assignee exists to confirm
// it, so the step's own assignee (who submitted it) finalizes it
// themselves rather than the President having to step in. See
// 0017_self_resolve_unconfirmable_step.sql.
export async function finishUnconfirmableStep(taskId: string, assigneeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_unconfirmable_step_rpc", { p_assignee_id: assigneeId });
  if (error) return { error: friendlyError(error, "We couldn't finish that step") };
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

// Permanent, irreversible removal — only ever offered in the UI once a task
// is already cancelled. See 0018_announcement_and_task_delete_rpcs.sql.
export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_cancelled_task_rpc", { p_task_id: taskId });
  if (error) return { error: friendlyError(error, "We couldn't delete the task") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function addComment(taskId: string, body: string) {
  if (!body.trim()) return { error: "Comment can't be empty." };
  const supabase = await createClient();
  const { data: commentId, error } = await supabase.rpc("add_task_comment_rpc", {
    p_task_id: taskId,
    p_body: encrypt(body.trim()),
  });
  if (error || !commentId) return { error: friendlyError(error, "We couldn't post your comment") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}
