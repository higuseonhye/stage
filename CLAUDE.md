@AGENTS.md

# Stage — Product Philosophy & Architecture Intent

## Why this product exists

Stage is built for people who make decisions without the luxury of 
a perfect environment. Not Silicon Valley networks, not large teams, 
not unlimited resources. People who decide alone, own the outcome, 
fail, and decide again.

The product exists to make their decisions better — not to decide 
for them.

## Core principle

**AI does not decide. The Director decides.**

Every feature must preserve this. If a feature reduces the Director's 
agency, it does not belong in Stage.

This is the opposite of every other AI tool on the market.
Everyone else sells "AI will do it for you."
Stage sells "You will decide better."

## The user

- Makes decisions proactively and owns the consequences
- When they fail, they absorb it and decide again
- Their decision-making story is their asset — not their network, 
  not their environment

## Product language (never break this)

| Code term | What it means |
|---|---|
| Actor | AI agent |
| Stage / Panel | Where agents work |
| Director | The user |
| Cue | User approval before execution |
| Performance | Execution after Cue |
| Script | Immutable audit trail |

## The debate structure (core differentiator)

Current state: agents respond in parallel independently.
This is NOT a debate. This must change.

Target structure:
- Round 1 — each agent states their position
- Round 2 — each agent attacks the weaknesses in others' positions
- Round 3 — each agent responds to the attacks
- Synthesis — a neutral summary of all rounds for the Director to read

The Director reads the Synthesis and gives the Cue.
The decision and its quality belong entirely to the Director.

This is why Stage exists.
The debate is the blessing being passed on.

## What Stage is NOT

- Not an automation tool
- Not "AI that acts on your behalf"
- Not a chatbot
- Not NotebookLM (their debate is audio content, not decision workflow)

## Roadmap boundary

Phase A (now): debate structure + human cue + audit trail
Phase B (later): public decision stories as portfolio

Do not build Phase B features into Phase A.
