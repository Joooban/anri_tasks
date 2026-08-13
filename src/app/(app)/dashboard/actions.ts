"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BossDashboardWidget } from "@/lib/types";

export async function saveBossDashboardPrefs(
  enabledWidgets: BossDashboardWidget[],
  widgetOrder: BossDashboardWidget[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("boss_dashboard_prefs")
    .upsert({ profile_id: user.id, enabled_widgets: enabledWidgets, widget_order: widgetOrder });

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null };
}
