import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  countRunsCreatedSinceUtc,
  MAX_RUNS_PER_DAY,
  utcDayStartIso,
  utcNextMidnightIso,
} from "@/lib/daily-run-quota";
import {
  countRunsForQuestion,
  MAX_RUNS_PER_QUESTION,
} from "@/lib/question-run-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") ?? "";
  const userMessage = searchParams.get("userMessage") ?? "";

  try {
    const since = utcDayStartIso();
    const dailyUsed = await countRunsCreatedSinceUtc(supabase, user.id, since);
    const dailyRemaining = Math.max(0, MAX_RUNS_PER_DAY - dailyUsed);

    let questionUsed = 0;
    let questionRemaining = MAX_RUNS_PER_QUESTION;
    if (topic.trim()) {
      questionUsed = await countRunsForQuestion(
        supabase,
        user.id,
        topic,
        userMessage,
      );
      questionRemaining = Math.max(0, MAX_RUNS_PER_QUESTION - questionUsed);
    }

    return NextResponse.json({
      daily: {
        limit: MAX_RUNS_PER_DAY,
        used: dailyUsed,
        remaining: dailyRemaining,
        resetsAt: utcNextMidnightIso(),
      },
      question: {
        limit: MAX_RUNS_PER_QUESTION,
        used: questionUsed,
        remaining: questionRemaining,
        applies: topic.trim().length > 0,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to load run quota" },
      { status: 500 },
    );
  }
}
