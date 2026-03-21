import Link from "next/link";
import type { Metadata } from "next";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Why Stage — human cue, auditable script",
  description:
    "The wedge: approval before execution, append-only audit, decision memo as artifact. Built with conviction, not a big team.",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-full flex-col">
      <PublicSiteHeader />
      <main className="mx-auto flex max-w-2xl flex-1 flex-col px-6 py-12">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-6 self-start text-muted-foreground",
          )}
        >
          ← Home
        </Link>
        <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
          Authenticity
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Why this exists
        </h1>
        <div className="text-muted-foreground mt-8 space-y-5 text-base leading-relaxed">
          <p className="text-foreground/95 text-lg leading-relaxed">
            The market is full of agents that <em>act</em> first and ask later.
            Stage is the opposite: a panel discusses, you hold the{" "}
            <strong className="text-foreground">cue</strong>, and only then does{" "}
            <strong className="text-foreground">performance</strong> run. Every
            beat is written to the <strong className="text-foreground">script</strong>{" "}
            — append-only, filterable — so you can stand behind a decision under
            scrutiny from investors, regulators, or your own team.
          </p>
          <p>
            The <strong className="text-foreground">wedge</strong> is not “more
            autonomy.” It is <strong className="text-foreground">governance</strong>
            : a human approval gate before expensive execution, a structured
            pipeline afterward, and a <strong className="text-foreground">decision memo</strong>{" "}
            generated from real artifacts (discussion, cue, steps) — not vibes.
          </p>
          <p>
            This product is built by a small team with no obligation to pretend
            we are a big Silicon Valley company. What you see is what we believe
            enterprise and global buyers will demand next:{" "}
            <strong className="text-foreground">traceability</strong>,{" "}
            <strong className="text-foreground">limits</strong>, and{" "}
            <strong className="text-foreground">honest defaults</strong> (rate
            limits, quotas, optional observability). Names and logos change; the
            posture should not.
          </p>
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Create account
          </Link>
          <Link
            href="/runs/new"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            New run
          </Link>
        </div>
      </main>
    </div>
  );
}
