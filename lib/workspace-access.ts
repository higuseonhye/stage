import type { SupabaseClient } from "@supabase/supabase-js";

/** Owner or invited member can access runs in this workspace. */
export async function userHasWorkspaceAccess(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const { data: ws } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (ws?.owner_id === userId) return true;
  const { data: mem } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!mem;
}

/** Workspaces where the user is owner or listed as member (for dashboards). */
export async function getAccessibleWorkspaceIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const ids = new Set<string>();
  const { data: owned } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId);
  for (const w of owned ?? []) {
    ids.add(w.id);
  }
  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);
  for (const m of member ?? []) {
    ids.add(m.workspace_id);
  }
  return [...ids];
}
