import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureWorkspaceForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("workspaces")
    .insert({ owner_id: userId, name: "Workspace" })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}
