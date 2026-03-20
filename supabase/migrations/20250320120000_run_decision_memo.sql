-- Auto-generated decision memo (filled after performance completes)
alter table public.runs
  add column if not exists decision_memo_markdown text;

comment on column public.runs.decision_memo_markdown is
  'LLM-filled one-pager from topic, discussion, cue, and execution steps';
