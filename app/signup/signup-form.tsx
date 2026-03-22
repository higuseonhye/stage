"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createBrowserSupabaseClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { safeNextPath } from "@/lib/safe-next-path";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      router.push(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const next = searchParams.get("next");
  const supabaseReady = isSupabaseBrowserConfigured();

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign up</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create your director account
          </p>
        </div>
        {!supabaseReady ? (
          <div className="border-amber-500/40 bg-amber-500/5 text-amber-100/90 rounded-md border p-3 text-xs leading-relaxed">
            <p className="font-medium text-amber-200/95">Supabase env is not set</p>
            <p className="mt-2 text-amber-100/85">
              Create <code className="text-amber-50">.env.local</code> in the
              project root (copy from{" "}
              <code className="text-amber-50">.env.example</code>), add{" "}
              <code className="text-amber-50">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="text-amber-50">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
              from Supabase → Project Settings → API, then restart{" "}
              <code className="text-amber-50">npm run dev</code>.
            </p>
          </div>
        ) : null}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {err ? (
            <p className="text-destructive font-mono text-xs">{err}</p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={busy || !supabaseReady}
          >
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link
            href={
              next ? `/login?next=${encodeURIComponent(next)}` : "/login"
            }
            className="text-foreground underline"
          >
            Sign in
          </Link>
        </p>
        <p className="text-center">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            ← Home
          </Link>
        </p>
      </div>
    </div>
  );
}
