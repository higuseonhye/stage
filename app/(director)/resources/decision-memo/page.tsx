import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { MemoMarkdown } from "@/components/MemoMarkdown";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Decision memo — one page",
  description:
    "Generic printable one-pager for any Stage run: options, risks, decision, sign-off.",
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
      <MemoMarkdown source={source} />
    </div>
  );
}
