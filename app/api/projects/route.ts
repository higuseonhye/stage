import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  contextGraphSchema,
  initialSnapshotFromGraph,
} from "@/lib/context-graph";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().max(8000).optional().default(""),
  /** When present, seeds `context_snapshot` from the validated Context Layer graph. */
  contextGraph: contextGraphSchema.optional(),
});

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, goal, context_snapshot, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error.message || "Failed to list projects",
        hint:
          error.message?.includes("schema cache") ||
          error.message?.includes("does not exist")
            ? "Apply supabase/migrations/20250320140000_projects.sql in the Supabase SQL Editor."
            : undefined,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ projects: projects ?? [] });
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

  const { name, goal, contextGraph } = parsed.data;

  const snapshot = contextGraph
    ? initialSnapshotFromGraph(contextGraph)
    : {};

  const { data: row, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      goal: goal || null,
      context_snapshot: snapshot,
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    const msg = error.message || "Failed to create project";
    const hint =
      msg.includes("does not exist") || msg.includes("schema cache")
        ? "Run the SQL in supabase/migrations/20250320140000_projects.sql on your Supabase project (tables + RLS)."
        : undefined;
    return NextResponse.json(
      { error: msg, code: error.code, hint },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: row.id });
}
