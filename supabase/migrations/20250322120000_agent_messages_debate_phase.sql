-- Debate structure: label each transcript row (position / attack / defense / synthesis)

alter table public.agent_messages
  add column if not exists debate_phase text;

comment on column public.agent_messages.debate_phase is
  'Debate phase: position, attack, defense, or synthesis';
