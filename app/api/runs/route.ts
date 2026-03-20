import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureWorkspaceForUser } from "@/lib/workspace";

const createSchema = z.object({
  topic: z.string().min(1).max(2000),
  userMessage: z.string().max(8000).optional().default(""),
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

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { topic, userMessage } = parsed.data;

  try {
    const workspaceId = await ensureWorkspaceForUser(supabase, user.id);
    const { data: run, error } = await supabase
      .from("runs")
      .insert({
        workspace_id: workspaceId,
        topic,
        user_message: userMessage,
        status: "discussing",
      })
      .select("id")
      .single();

    if (error) throw error;

    await supabase.from("audit_events").insert({
      run_id: run.id,
      event_type: "run_started",
      payload: { topic, user_id: user.id },
    });

    return NextResponse.json({ id: run.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to create run" },
      { status: 500 },
    );
  }
}
