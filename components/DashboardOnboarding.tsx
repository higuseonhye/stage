"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "stage_onboard_dismissed_v1";

export function DashboardOnboarding() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        startTransition(() => setVisible(true));
      }
    } catch {
      startTransition(() => setVisible(true));
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="border-primary/30 from-primary/[0.07] mb-8 rounded-xl border bg-gradient-to-r to-transparent px-4 py-4">
      <p className="text-foreground text-sm font-medium">
        How Stage works (once)
      </p>
      <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
        <li>
          <strong className="text-foreground/90">Stage</strong> — four actors
          discuss in rounds; you see refinement and a saved transcript.
        </li>
        <li>
          <strong className="text-foreground/90">Cue</strong> — you approve,
          edit, or deny before anything executes.
        </li>
        <li>
          <strong className="text-foreground/90">Performance</strong> — a
          four-step pipeline runs only after approval.
        </li>
        <li>
          <strong className="text-foreground/90">Script + memo</strong> — audit
          events stream in; when the run completes, a decision memo is generated
          from your artifacts.
        </li>
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            try {
              window.localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          Got it
        </Button>
        <Link
          href="/about"
          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
        >
          Why we built it
        </Link>
      </div>
    </div>
  );
}
