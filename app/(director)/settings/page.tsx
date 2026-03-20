"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const THEME_KEY = "stage-light-mode";

export default function SettingsPage() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        setLight(localStorage.getItem(THEME_KEY) === "1");
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", !light);
    try {
      localStorage.setItem(THEME_KEY, light ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [light]);

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link
        href="/dashboard"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-6 -ml-2 inline-flex",
        )}
      >
        ← Runs
      </Link>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Workspace and environment notes for the director console.
      </p>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="light">Light mode</Label>
            <p className="text-muted-foreground mt-1 text-xs">
              Default is dark. Toggle for a light director console.
            </p>
          </div>
          <Switch
            id="light"
            checked={light}
            onCheckedChange={setLight}
          />
        </div>

        <Separator />

        <div>
          <h2 className="mb-2 text-sm font-medium">API keys</h2>
          <p className="text-muted-foreground font-mono text-xs leading-relaxed">
            Configure <code className="text-foreground">ANTHROPIC_API_KEY</code>
            , <code className="text-foreground">OPENAI_API_KEY</code>, and
            Supabase keys in <code className="text-foreground">.env.local</code>{" "}
            locally or in Vercel project settings for production. This UI does
            not store secrets.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium">Workspace</h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            MVP uses one workspace per account, created automatically on your
            first run.
          </p>
        </div>
      </div>
    </div>
  );
}
