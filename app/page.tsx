import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-6 py-24">
        <p className="text-muted-foreground mb-3 font-mono text-xs tracking-widest uppercase">
          Stage
        </p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          AI agents on stage.
          <br />
          <span className="text-muted-foreground">You direct.</span>
        </h1>
        <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
          Actors discuss in parallel on the panel. You hold the cue: approve,
          edit, or deny before the performance runs. Every beat is logged to the
          script.
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
        </div>
        <dl className="text-muted-foreground mt-16 grid gap-6 font-mono text-xs md:grid-cols-2">
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
            <dd>CI-style steps with retry on failure.</dd>
          </div>
          <div>
            <dt className="text-foreground mb-1 font-sans text-sm font-medium">
              Audit → script
            </dt>
            <dd>Append-only events, filterable by type.</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
