import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  token: z.string().min(16).max(128),
});

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
    return NextResponse.json(parsed.error.flatten(), { status: 400 });
  }

  const { data, error } = await supabase.rpc("accept_workspace_invite", {
    p_token: parsed.data.token,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("invalid_or_expired")) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 400 },
      );
    }
    if (msg.includes("owner_no_join")) {
      return NextResponse.json(
        { error: "Workspace owners join via their own account" },
        { status: 400 },
      );
    }
    if (msg.includes("Could not find")) {
      return NextResponse.json(
        { error: "Invite system not deployed — run migration 20250321180000_workspace_team.sql" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true, workspaceId: data as string });
}
