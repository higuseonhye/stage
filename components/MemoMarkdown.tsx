"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MemoMarkdown({ source }: { source: string }) {
  return (
    <article className="memo-md text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </article>
  );
}
