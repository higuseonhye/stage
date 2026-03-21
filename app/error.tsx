"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
        Something broke
      </p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">
        We couldn&apos;t finish that
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {error.message || "Unexpected error — your work is still saved where the server wrote it."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to runs
        </Link>
      </div>
    </div>
  );
}
