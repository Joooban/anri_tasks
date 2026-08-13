"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";
import { revalidateTaskRelatedPaths } from "@/lib/revalidate-task-paths";

async function getActingProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profileId: null };
  return { supabase, profileId: user.id };
}

// Marks the caller's active step done — or, if the step requires the next
// assignee's confirmation, moves it to 'pending_approval' instead. The
// relay-advance trigger (0002_functions_triggers.sql) takes it from there.
export async function completeStep(taskId: string, assigneeId: string, requiresConfirmation: boolean) {
  const { supabase, profileId } = await getActingProfile();
  if (!profileId) return { error: "Not signed in." };

  const { error } = await supabase
    .from("task_assignees")
    .update({
      status: requiresConfirmation ? "pending_approval" : "done",
      completed_at: new Date().toISOString(),
      completed_by: profileId,
    })
    .eq("id", assigneeId);

  if (error) return { error: friendlyError(error, "We couldn't update that step") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

// The next step's assignee confirms a 'pending_approval' step, finalizing
// it as done and advancing the chain.
export async function confirmStep(taskId: string, assigneeId: string) {
  const { supabase, profileId } = await getActingProfile();
  if (!profileId) return { error: "Not signed in." };

  const { error } = await supabase
    .from("task_assignees")
    .update({ status: "done", completed_at: new Date().toISOString(), completed_by: profileId })
    .eq("id", assigneeId);

  if (error) return { error: friendlyError(error, "We couldn't confirm that step") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function blockStep(taskId: string, assigneeId: string, notes: string) {
  const { supabase, profileId } = await getActingProfile();
  if (!profileId) return { error: "Not signed in." };

  const { error } = await supabase
    .from("task_assignees")
    .update({ status: "blocked", notes })
    .eq("id", assigneeId);

  if (error) return { error: friendlyError(error, "We couldn't mark that step blocked") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function unblockStep(taskId: string, assigneeId: string) {
  const { supabase, profileId } = await getActingProfile();
  if (!profileId) return { error: "Not signed in." };

  const { error } = await supabase.from("task_assignees").update({ status: "active" }).eq("id", assigneeId);
  if (error) return { error: friendlyError(error, "We couldn't resume that step") };

  await supabase.from("tasks").update({ status: "in_progress" }).eq("id", taskId);
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function cancelTask(taskId: string) {
  const { supabase, profileId } = await getActingProfile();
  if (!profileId) return { error: "Not signed in." };

  const { error } = await supabase.from("tasks").update({ status: "cancelled" }).eq("id", taskId);
  if (error) return { error: friendlyError(error, "We couldn't cancel the task") };
  revalidateTaskRelatedPaths(taskId);
  return { error: null };
}

export async function addComment(taskId: string, body: string) {
  const { supabase, profileId } = await getActingProfile();
  if (!profileId) return { error: "Not signed in." };
  if (!body.trim()) return { error: "Comment can't be empty." };

  const { error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, author_id: profileId, body: body.trim() });

  if (error) return { error: friendlyError(error, "We couldn't post your comment") };
  revalidatePath(`/tasks/${taskId}`);
  return { error: null };
}

export async function getAttachmentUrl(storagePath: string) {
  const { supabase } = await getActingProfile();
  const { data, error } = await supabase.storage
    .from("task-attachments")
    .createSignedUrl(storagePath, 60 * 5);
  if (error || !data) return null;
  return data.signedUrl;
}
