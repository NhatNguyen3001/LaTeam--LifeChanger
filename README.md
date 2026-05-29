# Lifechanger Impact AI

An AI web app that turns **Lifechanger's** program + feedback data into plain-English answers,
interactive inline dashboards, and audience-tailored **impact reports (PDF)**.

Built for Hack Day for **Lifechanger**, a youth-mentoring not-for-profit. Staff ask questions like
*"Which workshops had the best outcomes last term?"* or *"Which schools are underperforming?"* and
get grounded answers — backed by both the quantitative survey scores and the qualitative free-text
feedback — with charts rendered right in the conversation.

> **Status:** Planning complete, implementation in progress. See [`.claude/PROJECT_PLAN.md`](.claude/PROJECT_PLAN.md)
> for the phase-by-phase build plan.

---

## What it does

| Capability | How |
|---|---|
| Plain-English Q&A over program data | Claude + tool-calling (text-to-SQL + semantic search) |
| Analyse numbers **and** text feedback (themes, sentiment, trends) | Pre-computed at ingest + live SQL / vector queries |
| Inline interactive dashboards | `make_dashboard` tool → generative UI (filter & drill down without leaving the chat) |
| Audience-tailored impact reports | One-shot pipeline → printable HTML → PDF (funder / school / board) |
| Impact storytelling & equity insight | Claude narrative over de-identified aggregates |

## Tech stack

- **Framework:** Next.js (App Router, TypeScript)
- **AI:** Vercel AI SDK + Claude (Anthropic API)
- **Database:** Supabase (Postgres + `pgvector`)
- **ORM:** Drizzle
- **UI:** shadcn/ui + Tailwind CSS
- **Charts:** Recharts (one chart library reused across chat, dashboards, and PDF)
- **PDF:** Puppeteer (prints the report HTML page)

A single all-TypeScript stack was chosen over a Python/ML service to keep one repo and one deploy
for the hackathon; heavy statistics are deferred in favour of SQL aggregates + LLM interpretation.
Full rationale in [`.claude/tech_stack_planning.md`](.claude/tech_stack_planning.md).

## The data

The app runs on a mock export, [`.claude/LifeChanger_Workshop_Feedback.csv`](.claude/LifeChanger_Workshop_Feedback.csv),
whose schema **mirrors Lifechanger's real Salesforce export** — so it plugs into the real data with
little to no change.

- **300 rows / 60 submissions** (one row per *answer*; a submission spans 5 question rows), **17 schools**, **21 workshops**, 5 pillars (HEALTH, SELF, SKILLS, PURPOSE, TRIBE).
- **180 Likert rows** (avg 4.11 / 5) + **120 open-ended rows** (the NLP corpus).
- Full column reference: [`.claude/DATA_DICTIONARY.md`](.claude/DATA_DICTIONARY.md).

> ⚠️ The CSV header is saved with a UTF-8 BOM — parse it as `utf-8-sig`.

## Getting started

> The Next.js app is being scaffolded as part of [Phase 1](.claude/PROJECT_PLAN.md). Until then,
> these are the intended setup steps.

### Prerequisites
- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/)
- A [Supabase](https://supabase.com/) project with the `pgvector` extension enabled
- An embedding-model API key (e.g. OpenAI `text-embedding-3-small`)

### Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local      # then fill in your keys

# 3. Apply the database schema
npm run db:migrate

# 4. Seed the database (parses the CSV, tags sentiment/themes + embeds open-ended answers)
npm run seed

# 5. Run the dev server
npm run dev                     # http://localhost:3000
```

### Environment variables
See [`.env.example`](.env.example). At minimum:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude — chat, ingest tagging, report writing |
| `DATABASE_URL` | Supabase Postgres connection string |
| `EMBEDDING_API_KEY` | Embeddings for `search_feedback` (pgvector) |

## Project structure

```
app/                  Next.js routes — chat UI, /report/[id], API routes
components/            chat, dashboard (widget catalog), report views, shadcn ui/
lib/
  ai/                 Anthropic client, system prompt, tools (query_data, search_feedback, make_dashboard)
  db/                 Drizzle schema, client, query helpers
  dashboard/          dashboard spec types + server-side data cache
  report/             Puppeteer PDF
scripts/seed.ts       CSV -> Postgres + LLM tagging + embeddings
data/                 dataset for seeding
.claude/              planning docs (plan, tech stack, data dictionary, dataset)
```

See [`.claude/PROJECT_PLAN.md` §4](.claude/PROJECT_PLAN.md) for the full recommended tree and data model.

## Documentation

| Doc | What's in it |
|---|---|
| [`.claude/PROJECT_PLAN.md`](.claude/PROJECT_PLAN.md) | Execution plan — phases P0–P9 (code + non-code), data model, file structure, risks, demo DoD |
| [`.claude/tech_stack_planning.md`](.claude/tech_stack_planning.md) | Architecture & design decisions (the *what* and *why*) |
| [`.claude/DATA_DICTIONARY.md`](.claude/DATA_DICTIONARY.md) | Every column in the dataset |

---

*Hack Day project. The dataset is mock data shaped to match Lifechanger's real Salesforce export.*
