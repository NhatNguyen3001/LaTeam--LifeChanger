# Tech Stack Planning — Lifechanger Impact AI

> Hack Day build for **Lifechanger** (youth-mentoring NFP).
> Goal: an AI web app that analyses program + feedback data (quantitative + qualitative),
> answers plain-English questions, renders inline dashboards, and auto-generates
> audience-tailored impact reports as PDFs.
> Last updated: 2026-05-29

---

## 1. Product summary

A Claude-like chat app over Lifechanger's program data. Staff ask plain-English
questions ("Which workshops had the best outcomes last term?", "Which schools are
underperforming?"); the assistant answers with text **and inline interactive
dashboards**, and can auto-generate a funder/school/board-ready **PDF report**.

| Capability | How we deliver it |
|---|---|
| Analyse numbers + text feedback (themes, sentiment, trends) | Pre-computed at ingest + live SQL/vector queries |
| Correlate conditions with outcomes, flag risks | SQL aggregates + LLM interpretation (no heavy ML for v1) |
| Audience-tailored auto reports | One-shot report pipeline → PDF |
| Plain-English Q&A | Claude + tool-calling (text-to-SQL + semantic search) |
| Impact storytelling | Claude narrative generation over de-identified aggregates |

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router, TypeScript)** | UI + API routes in one repo, deploys to Vercel fast |
| AI glue | **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`) | Streaming, message history, tool-calling, generative UI |
| LLM | **Claude (Anthropic API)** | Strong qualitative analysis + report writing |
| Database | **Supabase (Postgres + pgvector)** | Stores chats/messages + powers semantic search; also auth |
| ORM | **Drizzle ORM** | Typed schema + migrations, all-TS |
| UI kit | **shadcn/ui + Tailwind** | Polished, non-generic, fast |
| Charts | **Recharts** (via shadcn charts) | One chart lib reused across chat / dashboard / PDF |
| PDF export | **Puppeteer** (print an HTML page) | Reuses the same chart components — no second chart pipeline |
| (optional) | **assistant-ui** | Drop-in chat thread + generative UI; potential accelerator |

**Decision:** single all-TypeScript stack chosen over Python/FastAPI+ML — fewer moving
parts for the hackathon; heavy stats deferred in favour of SQL aggregates + LLM interpretation.

---

## 3. Architecture overview

```
┌─────────────── Next.js app ───────────────┐
│  ┌─ sidebar ─┬──────────── main ─────────┐ │
│  │ chat list │ streaming thread          │ │
│  │ + new     │  ├ text answers           │ │
│  │           │  └ inline dashboards      │ │
│  │           │ [ ask in plain English… ] │ │
│  └───────────┴───────────────────────────┘ │
│        "Generate impact report" → PDF       │
│                                             │
│  /api/chat     → Claude + tools (stream)    │
│  /api/report   → one-shot report pipeline   │
│  /report/[id]  → printable HTML report page │
└─────────────────────────────────────────────┘
              │ Drizzle
              ▼
        Supabase Postgres (+ pgvector)
  schools · sessions · participants · feedback
  chats · messages · reports
```

### Data flow (ingest once)
```
CSV/JSON export (Salesforce + feedback)
   │  one-time TS seed script
   ▼
Postgres rows
   │  at seed time, run Claude over each free-text comment
   ▼
store sentiment label + themes[] + embedding(vector)  ← pre-computed
```
**Key principle:** the expensive LLM tagging happens **once at ingest**, not per question.
Live chat then only runs cheap SQL + pgvector lookups → fast & cheap to demo.

---

## 4. Data model (draft — finalise once export columns are known)

```sql
schools(id, name, region, ...)
sessions(id, school_id, type, term, date, facilitator, ...)
participants(id, school_id, cohort, ...)              -- de-identified
feedback(
  id, session_id, participant_id,
  -- quantitative
  score_overall, score_confidence, ...,
  -- qualitative
  comment text,
  -- pre-computed at ingest:
  sentiment text,            -- positive | neutral | negative
  themes text[],             -- e.g. {confidence, engagement, facilitator}
  embedding vector(1536),
  term text, created_at timestamptz
)

chats(id, title, created_at)
messages(id, chat_id, role, content jsonb, created_at)  -- content holds text + tool results
reports(id, audience, spec jsonb, created_at)           -- saved report composition
```

**Data-prep asks (for the export):** one file per entity with stable IDs to join on;
each feedback row must carry the **free-text comment + numeric scores + a date/term**
(the date powers every trend chart and the report).

---

## 5. Chat: memory + grounding

- **Multiple stored chats:** `chats` / `messages` tables, ChatGPT-style sidebar.
- **Conversation memory:** the thread for a `chat_id` is replayed to Claude each turn
  (handles "…and the term before?" follow-ups).
- **Data grounding via tools** Claude can call:
  - `query_data(...)` → parameterised **text-to-SQL** over the structured tables
    (quant questions: scores, counts, trends, group-by school/term/cohort).
  - `search_feedback(query)` → **pgvector** similarity over free-text comments
    (qualitative: "what themes show up in negative feedback?").
  - `make_dashboard(...)` → returns a dashboard **spec** the client renders inline (below).

---

## 6. Inline dashboards (flexible + interactive)

A single answer can render a **dashboard block** — multiple widgets in a responsive grid —
not just one chart. Claude composes it from a fixed **widget catalog**:

```ts
make_dashboard({
  title: "Term 1 2025 overview",
  filters: [                       // interactive controls rendered above the grid
    { kind: "termRange", default: ["2024-T1", "2025-T1"] },
    { kind: "schoolSelect", multi: true }
  ],
  widgets: [
    { kind: "stat", label: "Avg overall score", value: 8.2, delta: +0.4 },
    { kind: "stat", label: "Sessions",          value: 142 },
    { kind: "stat", label: "Positive sentiment", value: "71%" },
    { kind: "line", title: "Sentiment by term", x: "term", series: [...] },
    { kind: "bar",  title: "Score by school",   x: "school", series: [...] },
    { kind: "pie",  title: "Theme breakdown",   series: [...] },
    { kind: "table", title: "Lowest-rated sessions", columns: [...], rows: [...] }
  ]
})
```

**Widget catalog:** `stat` (KPI tile), `line`, `bar`, `pie`, `table`. Each is one
Recharts/shadcn component; the renderer switches on `kind`.

**Interactivity:** the dashboard ships with declared `filters` (date/term range, school
multi-select, drilldown). The widget data is returned with enough underlying rows that
filtering happens **client-side** (snappy, no round-trip); for large result sets, controls
re-call a lightweight `/api/dashboard-data` endpoint. Drilldown = clicking a bar/row filters
the rest of the grid.

**Rendering path:** Vercel AI SDK generative UI — the client maps the `make_dashboard`
tool result to a `<Dashboard spec={...}/>` component rendered inside the message.

### 6b. Follow-ups & conversational state

The user will ask many follow-ups *about a rendered dashboard* ("why is that school low?",
"now just metro schools", "as a line chart"). To make this work without replaying full
datasets into context every turn:

**Persist each dashboard as a referenceable object.** The stored tool result keeps a compact,
self-describing spec — labeled datapoints + the per-widget query + a `dashboard_id`. Full rows
stay cached server-side (`data_ref`) and are fetched by id only when needed, never replayed inline.

```jsonc
{ "dashboard_id":"dsh_abc", "title":"Term 1 2025 overview", "filters":{"term":"2025-T1"},
  "widgets":[
    { "id":"w2", "kind":"bar", "title":"Score by school", "dim":"school", "metric":"avg_score",
      "data":[{"school":"A","v":8.9},{"school":"B","v":6.1}],            // compact, labeled, top-N
      "query":{"table":"feedback","groupBy":"school","agg":"avg(score_overall)","where":{"term":"2025-T1"}} }
  ],
  "data_ref":"cache:dsh_abc" }
```
The two payloads that make follow-ups work: **labeled datapoints** (so "that dip" / "school B"
resolve) and the **per-widget query** (so Claude *edits* it rather than rebuilding).

**Three follow-up paths, routed by where they're handled:**

| User does | Handled by | Result |
|---|---|---|
| Filters / drills down on a block (clicks, term picker) | **Client-side**, instant | That block re-renders in place — no LLM, no new message |
| Types a refinement ("just metro", "as a line") | **Claude** → `make_dashboard` | **New dashboard block** appended below (history preserved) |
| Asks a reasoning question ("why is B low?") | **Claude** → `query_data` / `search_feedback` | Text answer (+ optional supporting chart) |

**"Active dashboard context" (critical wiring).** On every chat message the frontend attaches a
snapshot of the currently-active dashboard to the prompt:
```
active_dashboard = most-recent (or last-interacted) block
                 + its CURRENT client-side filter state   ← so Claude reasons about what's on screen
                 + compact labeled datapoints + per-widget queries
```
This bridges the instant client-side path and the LLM path: if the user UI-filtered a block to
"metro" then asks "why did it drop?", Claude reasons about the metro view actually displayed —
not the originally generated one. Frontend tracks `lastInteractedDashboardId`; on ambiguous
references across multiple dashboards, Claude asks.

**Token discipline.** Only the **active** dashboard goes into context in full compact form; earlier
blocks compress to one-liners ("Term-1 overview, 4 widgets"). Static system prompt + schema + tool
defs are prompt-cached.

---

## 7. Report export (auto one-shot → PDF)

```
"Generate impact report"  (choose audience: funder | school | board)
   → pull relevant aggregates (SQL)
   → Claude writes the narrative + selects which charts to include
   → save a report spec to reports table
   → render /report/[id]  (HTML page reusing the SAME chart components)
   → Puppeteer prints the page → PDF download
```

- **Audience tailoring:** funder = numbers/evidence, school = stories, board = strategic insight.
  Same data, different Claude prompt + section mix.
- **Why this path:** the report page renders the exact same Recharts components, so charts in
  the PDF look identical to the chat — no separate image-generation step.
- **v1 fallback:** skip Puppeteer, use browser "Print to PDF" on `/report/[id]`.

---

## 8. Build order (suggested)

1. Next.js + Tailwind + shadcn scaffold; sidebar/main layout shell.
2. Supabase + Drizzle schema + migrations.
3. Seed script: load CSV/JSON → Postgres; LLM tagging + embeddings at ingest.
4. `/api/chat` with Claude + `query_data` and `search_feedback` tools (text first).
5. `make_dashboard` tool + `<Dashboard>` renderer (widget catalog, then filters/drilldown).
6. Conversational state (§6b): persist referenceable dashboard objects + "active dashboard context" sync (incl. client-side filter state) on each message.
7. Chat persistence (`chats`/`messages`) + sidebar wiring.
8. Report pipeline + `/report/[id]` page + PDF export.
9. Polish, seed demo data, rehearse the demo script.

---

## 9. Open items

- Final feedback export columns (drives §4 schema).
- Embedding model + dimension (e.g. OpenAI `text-embedding-3-small` 1536, or Voyage).
- Auth: needed for the demo, or single shared workspace? (Supabase Auth if yes.)
- De-identification rules for participant stories in reports.
- Hosting: Vercel for the app; Puppeteer needs a Node runtime (Vercel function or small server).
