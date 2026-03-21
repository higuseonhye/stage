import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-20">
        <p className="text-muted-foreground mb-3 font-mono text-xs tracking-widest uppercase">
          Stage
        </p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          AI agents on stage.
          <br />
          <span className="text-muted-foreground">You direct.</span>
        </h1>
        <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
          Actors discuss on the panel. You hold the cue: approve, edit, or deny
          before the performance runs. Every beat is logged to the script — so
          decisions hold up when someone asks{" "}
          <span className="text-foreground/90 italic">&quot;why did we ship that?&quot;</span>
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "default", size: "lg" }))}
          >
            Enter the theatre
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Create account
          </Link>
          <Link
            href="/about"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "text-muted-foreground",
            )}
          >
            Why Stage
          </Link>
        </div>

        <section className="border-border/60 bg-muted/15 mt-16 rounded-xl border p-6">
          <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            The wedge
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            In a world of autonomous agents, differentiation is not “more
            automation.” It is <strong className="text-foreground/95">governance</strong>
            : a hard stop before execution, an auditable trail, and a decision
            memo generated from what actually happened — not a generic chat
            summary. Built for US and global buyers who will ask for receipts.
          </p>
        </section>

        <dl className="text-muted-foreground mt-12 grid gap-6 font-mono text-xs md:grid-cols-2">
          <div>
            <dt className="text-foreground mb-1 font-sans text-sm font-medium">
              Agents → actors
            </dt>
            <dd>Four roles: Analyst, Critic, Strategist, Executor.</dd>
          </div>
          <div>
            <dt className="text-foreground mb-1 font-sans text-sm font-medium">
              Approval → cue
            </dt>
            <dd>Nothing executes until you clear the gate.</dd>
          </div>
          <div>
            <dt className="text-foreground mb-1 font-sans text-sm font-medium">
              Timeline → performance
            </dt>
            <dd>Sequential steps with retry on failure.</dd>
          </div>
          <div>
            <dt className="text-foreground mb-1 font-sans text-sm font-medium">
              Audit → script
            </dt>
            <dd>Append-only events; decision memo as final artifact.</dd>
          </div>
        </dl>

        <p className="text-muted-foreground/80 mt-14 max-w-lg text-center text-xs leading-relaxed md:text-left">
          No inflated story — just a product posture: human-in-the-loop by
          design, limits and traceability by default. If that matches how you
          want to work, you are in the right place.
        </p>
      </main>
    </div>
  );
}
