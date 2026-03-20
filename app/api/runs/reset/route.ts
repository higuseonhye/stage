import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureWorkspaceForUser } from "@/lib/workspace";

const bodySchema = z.object({
  /** Must match exactly — prevents accidental wipes */
  confirm: z.literal("DELETE_ALL_RUNS"),
});

/**
 * Deletes every run in the current user's workspace (and cascaded messages,
 * gates, steps, audit rows). Irreversible.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          'Send { "confirm": "DELETE_ALL_RUNS" } to delete all runs in your workspace.',
      },
      { status: 400 },
    );
  }

  try {
    const workspaceId = await ensureWorkspaceForUser(supabase, user.id);
    const { data: deleted, error } = await supabase
      .from("runs")
      .delete()
      .eq("workspace_id", workspaceId)
      .select("id");

    if (error) throw error;

    const count = deleted?.length ?? 0;
    return NextResponse.json({ ok: true, deletedCount: count });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to delete runs" },
      { status: 500 },
    );
  }
}
