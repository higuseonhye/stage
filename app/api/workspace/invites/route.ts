import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureWorkspaceForUser } from "@/lib/workspace";

const createSchema = z.object({
  /** Optional label; invite is link-based */
  email: z.string().email().optional(),
  /** Days until expiry (default 7) */
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

/**
 * POST — owner creates an invite (copy link). GET — list pending invites for owner workspace.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await ensureWorkspaceForUser(supabase, user.id);
  const { data: ws } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (ws?.owner_id !== user.id) {
    return NextResponse.json({ error: "Only workspace owner can manage invites" }, { status: 403 });
  }

  const { data: invites, error } = await supabase
    .from("workspace_invites")
    .select("id, email, token, created_at, expires_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invites: invites ?? [] });
}

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

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten(), { status: 400 });
  }

  const workspaceId = await ensureWorkspaceForUser(supabase, user.id);
  const { data: ws } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (ws?.owner_id !== user.id) {
    return NextResponse.json({ error: "Only workspace owner can create invites" }, { status: 403 });
  }

  const days = parsed.data.expiresInDays ?? 7;
  const expiresAt = new Date(Date.now() + days * 864_000_00).toISOString();
  const token = randomBytes(24).toString("hex");

  const { data: row, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email: parsed.data.email?.trim() || null,
      token,
      invited_by: user.id,
      expires_at: expiresAt,
    })
    .select("id, token, expires_at")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create invite — run supabase/migrations/20250321180000_workspace_team.sql" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, invite: row });
}
