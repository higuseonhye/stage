import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { MemoMarkdown } from "@/components/MemoMarkdown";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Memo template — printable one-pager",
  description:
    "Blank printable template (not your run’s AI memo). Generated memos live on each completed run.",
};

export default async function DecisionMemoPage() {
  const mdPath = path.join(process.cwd(), "docs", "decision-memo.md");
  const source = await readFile(mdPath, "utf-8");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/runs/new"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 inline-flex",
          )}
        >
          ← New run
        </Link>
        <Link
          href="/resources/first-hire-memo"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground",
          )}
        >
          First hire add-on →
        </Link>
      </div>
      <p className="text-muted-foreground border-border/60 bg-muted/20 mb-6 rounded-lg border px-4 py-3 text-sm leading-relaxed">
        This page is a <strong className="text-foreground/90">static blank</strong>{" "}
        you can print or copy. Your{" "}
        <strong className="text-foreground/90">AI-generated decision memo</strong>{" "}
        is saved per run on the run detail page after the pipeline finishes — it
        does not appear here automatically.
      </p>
      <MemoMarkdown source={source} />
    </div>
  );
}
