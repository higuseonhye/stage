"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type InviteRow = {
  id: string;
  email: string | null;
  token: string;
  created_at: string;
  expires_at: string;
};

function inviteAbsoluteUrl(token: string) {
  const base =
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")) ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/invite/${token}`;
}

export function SettingsWorkspaceInvites() {
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    setForbidden(false);
    try {
      const res = await fetch("/api/workspace/invites", {
        credentials: "include",
      });
      if (res.status === 403) {
        setForbidden(true);
        setInvites([]);
        return;
      }
      const j = (await res.json()) as {
        invites?: InviteRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : res.statusText,
        );
      }
      setInvites(j.invites ?? []);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e));
      setInvites([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createInvite = async () => {
    setCreateBusy(true);
    setLoadErr(null);
    try {
      const res = await fetch("/api/workspace/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        invite?: { id: string; token: string; expires_at: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : res.statusText,
        );
      }
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCreateBusy(false);
    }
  };

  const copyUrl = async (id: string, token: string) => {
    const url = inviteAbsoluteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-2 text-sm font-medium">Team invites</h2>
          <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
            Share a link so teammates can sign in and join this workspace.
            They&apos;ll see runs and can hold the cue in your space — not
            their own default workspace.
          </p>
        </div>
        {!forbidden ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={createBusy || invites === null}
            onClick={() => void createInvite()}
          >
            {createBusy ? "Creating…" : "New invite link"}
          </Button>
        ) : null}
      </div>

      {forbidden ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Only the workspace owner can create and list invites. Ask the owner to
          send you a link from Settings.
        </p>
      ) : null}

      {loadErr ? (
        <p className="text-destructive mt-2 font-mono text-xs">{loadErr}</p>
      ) : null}

      {!forbidden && invites && invites.length > 0 ? (
        <>
          <Separator className="my-4" />
          <ul className="space-y-3">
            {invites.map((inv) => {
              const url = inviteAbsoluteUrl(inv.token);
              return (
                <li
                  key={inv.id}
                  className="border-border/60 bg-card/30 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-muted-foreground font-mono text-[11px]">
                      Expires{" "}
                      {new Date(inv.expires_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => void copyUrl(inv.id, inv.token)}
                    >
                      {copiedId === inv.id ? "Copied" : "Copy invite URL"}
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-2 break-all font-mono text-[10px] leading-snug">
                    {url}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {!forbidden && invites && invites.length === 0 && !loadErr ? (
        <p className="text-muted-foreground mt-1 text-xs">
          No pending invites. Create one to copy a shareable URL (
          <code className="text-foreground/90">/invite/&lt;token&gt;</code>
          ).
        </p>
      ) : null}
    </div>
  );
}
