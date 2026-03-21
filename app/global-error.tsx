"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
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
    <html lang="en">
      <body className="bg-background text-foreground flex min-h-full flex-col items-center justify-center gap-4 p-8">
        <p className="font-mono text-xs tracking-widest uppercase">Stage</p>
        <h1 className="text-lg font-semibold">Critical error</h1>
        <p className="text-muted-foreground max-w-sm text-center text-sm">
          {error.message || "Please refresh the page."}
        </p>
        <button
          type="button"
          className="border-border rounded-md border px-4 py-2 text-sm font-medium"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
