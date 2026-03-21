import { dashboardSummaryFromSnapshot } from "@/lib/context-graph";

export function ProjectContextSnapshot({ snapshot }: { snapshot: unknown }) {
  const lines = dashboardSummaryFromSnapshot(snapshot);
  if (!lines.length) return null;
  return (
    <details className="border-border/60 bg-muted/10 mt-3 max-w-2xl rounded-lg border">
      <summary className="text-muted-foreground cursor-pointer px-3 py-2 font-mono text-[11px] tracking-wide uppercase">
        Context graph
      </summary>
      <ul className="text-muted-foreground space-y-1 border-t px-3 py-2 text-xs leading-relaxed">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </details>
  );
}
