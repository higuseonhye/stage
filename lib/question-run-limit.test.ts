import { describe, expect, it } from "vitest";
import {
  normalizeQuestionParts,
  questionRowMatches,
  MAX_RUNS_PER_QUESTION,
} from "@/lib/question-run-limit";

describe("normalizeQuestionParts", () => {
  it("trims and lowercases", () => {
    expect(normalizeQuestionParts("  Hello World  ", "  Brief  ")).toEqual({
      topic: "hello world",
      brief: "brief",
    });
  });

  it("collapses whitespace", () => {
    expect(normalizeQuestionParts("a\n\tb", "x   y")).toEqual({
      topic: "a b",
      brief: "x y",
    });
  });
});

describe("questionRowMatches", () => {
  it("matches normalized topic and brief", () => {
    const norm = normalizeQuestionParts("Topic", "Brief");
    expect(
      questionRowMatches(
        { topic: "  topic  ", user_message: "brief" },
        norm,
      ),
    ).toBe(true);
  });

  it("rejects different brief", () => {
    const norm = normalizeQuestionParts("Topic", "Brief");
    expect(
      questionRowMatches(
        { topic: "topic", user_message: "other" },
        norm,
      ),
    ).toBe(false);
  });
});

describe("MAX_RUNS_PER_QUESTION", () => {
  it("is 3", () => {
    expect(MAX_RUNS_PER_QUESTION).toBe(3);
  });
});
