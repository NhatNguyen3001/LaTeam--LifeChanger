<div align="center">

# Lifechanger Impact AI

**Ask plain-English questions about youth-mentoring program data and get grounded answers, interactive dashboards rendered inline, and audience-tailored impact reports.**

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-6-000000?logo=vercel&logoColor=white)](https://sdk.vercel.ai/)
[![Claude](https://img.shields.io/badge/Claude-Anthropic-D97757)](https://www.anthropic.com/)
[![Supabase](https://img.shields.io/badge/Supabase-pgvector-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

</div>

---

## Overview

**Lifechanger Impact AI** is a Claude-style chat application over the program and feedback data of
[Lifechanger](https://lifechanger.org.au/), a youth-mentoring not-for-profit that runs wellbeing
workshops in schools across five pillars: **Health, Self, Skills, Purpose, Tribe**.

Staff ask questions in plain English (*"How are workshop ratings trending?"*, *"Which schools are
underperforming?"*, *"What themes show up in students' feedback?"*) and the assistant answers from
the data, grounding every response in both the **quantitative** survey scores and the **qualitative**
free-text feedback. Answers can include **interactive dashboards rendered inline in the conversation**,
and a one-click **impact report** tailored to funders, schools, or the board.

> **Note on data:** this repository ships with a **mock dataset** whose schema mirrors Lifechanger's
> real Salesforce export, so the app plugs into production data with little to no change. No real
> student data is included.

## Features

- 💬 **Conversational analytics:** multi-turn chat with persisted history (sidebar of conversations, delete / clear).
- 🧮 **Quantitative Q&A:** `query_data` tool runs guarded, read-only SQL over the program tables (averages, counts, trends, group-by school/pillar/term, equity & facilitator breakdowns).
- 🗣️ **Qualitative Q&A:** `search_feedback` tool runs `pgvector` semantic search over open-ended answers for themes, sentiment, and representative quotes.
- 📊 **Inline interactive dashboards:** `make_dashboard` composes a spec from a widget catalog (`stat`, `line`, `bar`, `pie`, `table`) that renders **inside the chat**, with client-side **filters and drill-down**.
- 🔁 **Conversational dashboard state:** the on-screen dashboard (plus its current filter selection) is attached to follow-up questions, so *"why is that one low?"* reasons about the view you're actually looking at.
- 📄 **Audience-tailored impact reports:** a one-shot pipeline pulls SQL aggregates, has Claude write the narrative and pick charts, and renders a printable report page (**Print → Save as PDF**) for **funder / school / board**.
- ⚖️ **Equity & storytelling:** surfaces ICSEA-based equity reach and `HEARTWARMING`-flagged student stories, with de-identification rules baked into the prompts.
- 🎨 **Branded, responsive UI:** a warm Lifechanger design system (shadcn/ui + Tailwind), markdown-rendered answers, mobile drawer navigation.

## Architecture

```
┌──────────────────────────── Next.js (App Router) ────────────────────────────┐
│  Sidebar (chats, reports)        Main thread                                   │
│  ┌──────────────┐    ┌───────────────────────────────────────────────┐        │
│  │ conversations │    │  streaming answers (markdown)                  │        │
│  │ + new / del   │    │  └ inline <Dashboard> (Recharts widgets)       │        │
│  └──────────────┘    │  [ ask in plain English … ]                    │        │
│                       └───────────────────────────────────────────────┘        │
│   /api/chat   → Claude (Sonnet) + tools, streamed via Vercel AI SDK            │
│   /api/report → aggregates → Claude (Opus) narrative → /report/[id] → PDF      │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                     │ Drizzle ORM (postgres.js, pooled)
                                     ▼
                       Supabase Postgres + pgvector
        schools · agreements · workshops · submissions · answers
        chats · messages · dashboards · reports
```

**Ingest happens once.** A seed script parses the CSV into normalised tables and, for each open-ended
answer, pre-computes **sentiment + themes** (Claude Haiku) and an **embedding** (OpenAI). Live chat
then only runs cheap SQL + vector lookups, so responses are fast and inexpensive.

```
CSV export ──► seed script ──► Postgres rows
                    │ (once, at ingest)
                    └─► Claude sentiment/themes + OpenAI embeddings ─► stored as columns (cached)
```

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack, TypeScript) · React 19 |
| AI orchestration | **Vercel AI SDK 6** (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`, `@ai-sdk/openai`) |
| Models | **Claude Sonnet 4.6** (chat) · **Claude Opus 4.8** (reports) · **Claude Haiku 4.5** (ingest tagging) · OpenAI `text-embedding-3-small` (1536-d) |
| Database | **Supabase** (Postgres + `pgvector`) |
| ORM | **Drizzle ORM** + `postgres.js` |
| UI | **shadcn/ui** (Base UI) + **Tailwind CSS 4** + lucide-react + sonner |
| Charts | **Recharts 3** (one chart library reused across chat, dashboards, and reports) |
| Markdown | react-markdown + remark-gfm |

A single all-TypeScript stack keeps one repo and one deploy. Heavy statistics are intentionally
deferred in favour of SQL aggregates + LLM interpretation.

## Data model

Normalised from the flat CSV (grain: **one row per answer**; a submission spans multiple question rows):

| Table | Purpose |
|---|---|
| `schools` | School, region, geolocation, **ICSEA percentile** (equity), enrolments |
| `agreements` | Salesforce Opportunity: funder, stage, amount |
| `workshops` | Pillar/topic, date, facilitator, delivery debrief (compromised/deviated, "gems") |
| `submissions` | One student survey: year level, ATSI, gender |
| `answers` | Per-question answer · Likert `answer_value` (1-5) **or** open-ended text · pre-computed `sentiment`, `themes[]`, `embedding vector(1536)` |
| `chats` / `messages` | Conversation history |
| `dashboards` | Referenceable dashboard specs (for follow-ups) |
| `reports` | Saved report compositions |

**Mock dataset** (`data/LifeChanger_Workshop_Feedback.csv`): 300 answers · 60 submissions · 17 schools ·
21 workshops · 5 pillars · 180 Likert rows (avg 4.11/5) · 120 open-ended rows.

## Getting started

### Prerequisites

- **Node.js 20+**
- An **[Anthropic API key](https://console.anthropic.com/)**
- An **[OpenAI API key](https://platform.openai.com/)** (embeddings)
- A **[Supabase](https://supabase.com/)** project with the **`pgvector`** extension enabled

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy the template and fill in your keys:

```bash
cp .env.example .env        # .env and .env.local are both read by Next.js
```

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude: chat, ingest tagging, report writing |
| `OPENAI_API_KEY` | OpenAI embeddings for `search_feedback` |
| `DATABASE_URL` | Supabase **transaction pooler** (port `6543`), used by the app |
| `DIRECT_URL` | Supabase **session pooler** (port `5432`), used by migrations and seed |
| `NEXT_PUBLIC_SUPABASE_URL` / `*_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase project URL + keys |

> **Supabase connection note:** use the **pooler** host (`aws-<n>-<region>.pooler.supabase.com`,
> username `postgres.<project-ref>`). The direct `db.<ref>.supabase.co` host is IPv6-only and won't
> resolve on most networks. Copy both strings from **Project Settings → Database → Connection string**.

### 3. Enable pgvector & apply the schema

```sql
-- once, in the Supabase SQL editor:
create extension if not exists vector;
```

```bash
npm run db:migrate     # creates the tables
```

### 4. Seed the database

Parses the CSV, tags sentiment/themes (Claude Haiku) and embeds open-ended answers (OpenAI). Results
are cached to `data/enrichment-cache.json`, so re-seeding is free.

```bash
npm run seed
```

### 5. Run

```bash
npm run dev            # http://localhost:3000
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration from the schema |
| `npm run db:migrate` | Apply migrations to the database |
| `npm run db:push` | Push the schema directly (no migration files) |
| `npm run seed` | Ingest the CSV + LLM enrichment + embeddings |

## Project structure

```
app/
  (chat)/                 chat shell layout, landing page, /c/[chatId] thread
  report/[id]/            printable report page (Print → PDF)
  report/preview/[...]/   program-wide report preview
  api/
    chat/                 streaming chat + tool calls (Claude)
    chats/ , chats/[id]/  list / create / load / save / delete conversations
    dashboard-data/[id]/  re-fetch a dashboard's underlying rows
    report/               one-shot report pipeline
components/
  chat/                   thread, message, markdown, input, sidebar, shell
  dashboard/              <Dashboard> renderer + widget catalog
  report/                 report view (reuses chart components)
  ui/                     shadcn/ui primitives
lib/
  ai/                     models, system prompt, tools (query_data, search_feedback, make_dashboard)
  db/                     Drizzle schema, client, chat store
  dashboard/              dashboard spec types + active-dashboard context
  report/                 SQL aggregates + report types
  chat/                   message normalisation, dedupe, live-message helpers
scripts/seed.ts           CSV → Postgres + enrichment
data/                     mock dataset + enrichment cache
drizzle/                  generated migrations
```

## Roadmap

- [ ] Server-side PDF rendering via Puppeteer (current: browser **Print → Save as PDF**)
- [ ] Authentication / multi-tenant workspaces (current: single shared demo workspace)
- [ ] Live Salesforce sync (current: static CSV export → one-time seed)
- [ ] Map visualisations (school geolocation is already in the schema)

## Disclaimer

This project uses a **mock dataset** shaped to match Lifechanger's real Salesforce export. It contains
no real student information. Reports apply de-identification rules (no names; aggregate small cohorts;
prefer pre-vetted quotes).

---

<div align="center">
Built with Next.js, the Vercel AI SDK, and Claude.
</div>
