# Project Plan — Lifechanger Impact AI

> Hack Day build. Companion to `tech_stack_planning.md` (the *what* & *why*).
> This file is the *how* & *in-what-order* — execution steps (code + non-code) and the
> recommended repository structure.
> Last updated: 2026-05-29

---

## 0. Ground truth (confirmed from the data)

The schema is **locked** against the real export. `LifeChanger_Workshop_Feedback.csv`:

- **300 rows / 60 submissions** (5 answers each), **17 schools**, **21 workshops**,
  7 states, 5 pillars (HEALTH, SELF, SKILLS, PURPOSE, TRIBE).
- **Grain = one row per answer.** A submission spans 5 rows sharing `SUBMISSION_ID`.
- **180 Likert rows** (avg 4.11/5) + **120 open-ended rows** (the NLP corpus).
- Signals baked in: upward term trend, declining/underperforming schools, strong-vs-weak
  facilitators, ICSEA equity gains, `HEARTWARMING` flag (19 rows), 60 compromised-workshop rows.
- Date range 21/07/2025 → 23/06/2026.

This replaces the *draft* §4 schema in `tech_stack_planning.md` with the **normalised model in §3 below**.

> **Version control:** `.claude/` and `.wolf/` are git-ignored — they are **local-only** (planning
> docs, dataset source, OpenWolf memory) and won't be on GitHub. Consequence: the committed dataset
> must live in `data/` (P3), and any GitHub-facing doc (README) must **not** link into `.claude/`.

---

## 1. Phases at a glance

| Phase | Theme | Output | Blocking? |
|---|---|---|---|
| P0 | Decisions & accounts (non-code) | Keys, model choices, de-id rules | Unblocks everything |
| P1 | Scaffold | Running Next.js shell (sidebar + main) | — |
| P2 | Data layer | Drizzle schema + migrations applied | needs P1 |
| P3 | Ingest / seed | DB full of enriched rows | needs P0 keys, P2 |
| P4 | Chat backend | `/api/chat` + 3 tools (text answers) | needs P3 |
| P5 | Chat frontend + persistence | Multi-chat UI, streaming | needs P4 |
| P6 | Inline dashboards | `make_dashboard` + `<Dashboard>` | needs P5 |
| P7 | Conversational dashboard state | follow-ups, active-dashboard context | needs P6 |
| P8 | Report pipeline | audience-tailored PDF | needs P6 |
| P9 | Polish + demo | rehearsed demo, deployed | everything |

Demo-critical path if time is short: **P0 → P1 → P2 → P3 → P4 → P5 → P6**. P7/P8 are the
"wow" extras; P8 (report PDF) is the strongest single differentiator after a working dashboard.

---

## 2. Steps (code + non-code)

Legend: 🟦 code · 🟨 non-code/decision · 🟩 verify/demo

### P0 — Decisions & accounts (do first, no code) — ✅ DECIDED (see `P0_DECISIONS.md`)
- [x] 🟨 Models locked: **`claude-sonnet-4-6`** chat · **`claude-opus-4-8`** reports · **`claude-haiku-4-5`** ingest tagging. *(Anthropic key = user action.)*
- [ ] 🟨 Create **Supabase project**; enable `pgvector`; keys → `.env.local`. *(user action — walkthrough in `P0_DECISIONS.md` §4a)*
- [x] 🟨 **Embedding model locked:** OpenAI `text-embedding-3-small` → **`vector(1536)`** (use in P2). Needs `OPENAI_API_KEY`. *(key = user action.)*
- [x] 🟨 **De-identification rules** written (`P0_DECISIONS.md` §2): no names, prefer `HEARTWARMING` quotes, no re-identifying combos, suppress cells n<5, equity dims as aggregates only.
- [x] 🟨 **Auth:** none — single shared demo workspace (defer Supabase Auth).
- [x] 🟨 **Hosting/PDF:** Vercel; v1 PDF = browser Print-to-PDF on `/report/[id]`, harden later with Puppeteer + `@sparticuz/chromium`.
- [x] 🟨 **Demo script** drafted (`P0_DECISIONS.md` §3) — 6 questions: trend → dashboard → themes → risk → equity → story+report.

**P0 remaining (user action):** put `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and the Supabase `DATABASE_URL`/`DIRECT_URL`+keys into `.env.local`. Then P1 can start.

### P1 — Scaffold 🟦
- [ ] `npx create-next-app@latest` (App Router, TS, Tailwind, ESLint, src-less/app dir).
- [ ] `npx shadcn@latest init`; add primitives (button, input, card, scroll-area, select, dropdown-menu, table, skeleton, sonner).
- [ ] Build the **shell**: `app/(chat)/layout.tsx` = sidebar (chat list + "New chat") + main thread region + sticky composer.
- [ ] 🟩 `npm run dev` renders the empty Claude-like shell.

### P2 — Data layer 🟦
- [ ] Install `drizzle-orm`, `drizzle-kit`, `postgres` (or `@supabase/*`).
- [ ] Write `lib/db/schema.ts` = normalised tables (see §3).
- [ ] `drizzle.config.ts` → `drizzle-kit generate` → `drizzle-kit migrate` (or `push` for speed).
- [ ] 🟩 Confirm tables + `vector` column exist in Supabase.

### P3 — Ingest / seed 🟦 (the data-prep heart)
- [ ] Drop `LifeChanger_Workshop_Feedback.csv` into `data/`.
- [ ] `scripts/seed.ts`: parse CSV (`utf-8-sig` — **header has a BOM**), dedupe denormalised
      school/workshop/agreement rows into their tables, then insert submissions + answers.
- [ ] **Enrichment at ingest (once):** for each **open-ended** answer (`ANSWER_VALUE` blank),
      call Claude → `{ sentiment, themes[] }`; compute embedding. Batch + cache; skip Likert rows.
- [ ] Store `sentiment`, `themes`, `embedding` as columns on `answers`.
- [ ] 🟩 Spot-check: row counts match (300 answers, 60 submissions, 17 schools); a vector search returns sensible neighbours.

### P4 — Chat backend 🟦
- [ ] `lib/ai/client.ts` (Anthropic via Vercel AI SDK) + `lib/ai/system-prompt.ts` (schema description, pillars, equity framing, de-id rules; mark static parts for **prompt caching**).
- [ ] Tool `query_data` — guarded text-to-SQL over the structured tables (scores, counts, trends, group-by school/term/pillar/cohort).
- [ ] Tool `search_feedback` — pgvector similarity over open-ended answers.
- [ ] `/api/chat/route.ts` — stream Claude with both tools; **text answers only** at this stage.
- [ ] 🟩 Curl/Playground: ask "average Likert by pillar" (quant) and "themes in negative feedback" (qual) → correct grounded answers.

### P5 — Chat frontend + persistence 🟦
- [ ] `useChat` wiring; `components/chat/{chat-thread,message,message-input}.tsx`.
- [ ] Persist `chats` / `messages`; sidebar lists chats, `/(chat)/c/[chatId]` loads a thread; replay thread each turn.
- [ ] 🟩 Two browser tabs / refresh: chats persist, follow-ups ("…and the term before?") work.

### P6 — Inline dashboards 🟦
- [ ] `lib/dashboard/types.ts` — `DashboardSpec` + `Widget` union (`stat|line|bar|pie|table`).
- [ ] Tool `make_dashboard` — returns a spec; `components/dashboard/dashboard.tsx` switches on `widget.kind`, one Recharts/shadcn component per widget.
- [ ] Wire AI SDK **generative UI**: chat maps the tool result to `<Dashboard spec=…/>` inline.
- [ ] Add declared `filters` (term/date range, school multi-select) + drilldown; filter **client-side** on returned rows.
- [ ] 🟩 "Show me a Term overview dashboard" renders a multi-widget grid; client-side filter is instant.

### P7 — Conversational dashboard state 🟦
- [ ] Persist each dashboard as a **referenceable object**: compact labeled datapoints + per-widget query + `dashboard_id`; full rows in server-side cache (`lib/dashboard/cache.ts`), fetched by id.
- [ ] `/api/dashboard-data` for re-query on large sets.
- [ ] **Active-dashboard context**: on each message attach the last-interacted dashboard spec **+ current client-side filter state** + compact data; track `lastInteractedDashboardId`; new block per typed refinement (history preserved).
- [ ] 🟩 UI-filter a block to "metro", ask "why did it drop?" → Claude reasons about the on-screen view.

### P8 — Report pipeline 🟦
- [ ] `/api/report` — pick audience (funder | school | board) → pull aggregates → Claude writes narrative + selects charts → save `reports.spec`.
- [ ] `/report/[id]` — printable HTML page reusing the **same** chart components.
- [ ] `lib/report/pdf.ts` — Puppeteer print (v1 fallback: browser Print-to-PDF).
- [ ] 🟩 Generate all 3 audiences; PDF charts match the chat charts; quotes respect de-id rules.

### P9 — Polish + demo 🟩
- [ ] Loading/empty/error states; sonner toasts; mobile-narrow sidebar collapse.
- [ ] Deploy to Vercel; set env vars; smoke-test prod.
- [ ] Run `openwolf designqc` and fix UI issues.
- [ ] Rehearse the P0 demo script end-to-end; have a fallback (recorded clip / local run).

---

## 3. Data model (normalised — locked to the real columns)

```ts
// lib/db/schema.ts  (Drizzle)

schools            // 17 — from SCHOOL_* (dedupe by SCHOOL_ACCOUNT_ID)
  id (SCHOOL_ACCOUNT_ID) PK, name, state, region,
  lat, lng, icsea_percentile, enrolments

agreements         // Salesforce Opportunity (dedupe by SCHOOL_AGREEMENT_OPPORTUNITY_ID)
  id PK, school_id FK, name, stage, close_date, amount_cents

workshops          // 21 — from WORKSHOP_* + facilitator debrief (dedupe by WORKSHOP_SF_ID)
  id (WORKSHOP_SF_ID) PK, code, topic, region, location,
  date, start_time, end_time, school_id FK,
  lead_facilitator, facilitators_list, mentors_list,
  number_of_students, facilitator_rating,
  was_compromised, if_compromised, did_deviate, if_deviated,
  workshop_gems, anything_else

submissions        // 60 — one per student survey (dedupe by SUBMISSION_ID)
  id (SUBMISSION_ID) PK, workshop_id FK,
  year_level, atsi, gender, submitted_on

answers            // 300 — the grain
  id PK, submission_id FK,
  question_id, question_text, answer_text,
  answer_value int NULL,        // Likert 1–5; NULL for open-ended
  heartwarming bool,
  // pre-computed at ingest, OPEN-ENDED ONLY:
  sentiment text NULL,          // positive | neutral | negative
  themes text[] NULL,
  embedding vector(1536) NULL

// app tables
chats     (id, title, created_at)
messages  (id, chat_id FK, role, content jsonb, created_at)
reports   (id, audience, spec jsonb, created_at)
dashboards(id, chat_id FK, spec jsonb, data_ref, created_at)   // referenceable objects (§7)
```

Join path for charts: `answers → submissions → workshops → schools → agreements`. Trends use
`workshops.date` / `submissions.submitted_on`; equity uses `schools.icsea_percentile`,
`submissions.atsi/gender/year_level`.

---

## 4. Recommended file structure

```
GdAI/
├─ app/
│  ├─ (chat)/
│  │  ├─ layout.tsx              # sidebar (chat list + New) + main + composer
│  │  ├─ page.tsx                # new chat
│  │  └─ c/[chatId]/page.tsx     # existing thread
│  ├─ report/[id]/page.tsx       # printable HTML report (reuses chart components)
│  ├─ api/
│  │  ├─ chat/route.ts           # Claude + tools (streaming)
│  │  ├─ dashboard-data/route.ts # client-side re-query for large sets
│  │  └─ report/route.ts         # one-shot report pipeline
│  ├─ layout.tsx
│  └─ globals.css
├─ components/
│  ├─ ui/                        # shadcn primitives
│  ├─ chat/{chat-sidebar,chat-thread,message,message-input}.tsx
│  ├─ dashboard/
│  │  ├─ dashboard.tsx           # switches on widget.kind
│  │  ├─ dashboard-filters.tsx
│  │  └─ widgets/{stat,line,bar,pie,table}.tsx
│  └─ report/report-view.tsx     # shared chart layout for PDF + page
├─ lib/
│  ├─ ai/
│  │  ├─ client.ts               # Anthropic provider
│  │  ├─ system-prompt.ts        # schema/pillars/de-id (prompt-cached)
│  │  └─ tools/{query-data,search-feedback,make-dashboard}.ts
│  ├─ db/{schema.ts,index.ts,queries.ts}
│  ├─ dashboard/{types.ts,cache.ts}
│  └─ report/pdf.ts              # Puppeteer
├─ drizzle/                      # generated migrations
├─ scripts/seed.ts              # CSV → Postgres + LLM tagging + embeddings
├─ data/LifeChanger_Workshop_Feedback.csv   # committed dataset (copy here from .claude/)
├─ .claude/                     # planning docs + Claude/OpenWolf config — GIT-IGNORED (local only)
├─ .wolf/                       # OpenWolf memory/anatomy/cerebrum — GIT-IGNORED (local only)
├─ .env.local                   # ANTHROPIC_API_KEY, DATABASE_URL, EMBEDDING_API_KEY
├─ drizzle.config.ts
├─ components.json              # shadcn
├─ next.config.ts · tailwind.config.ts · tsconfig.json · package.json
```

---

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Text-to-SQL produces wrong/unsafe SQL | Constrain tool to a whitelist of tables/columns + parameterised aggregates; validate before exec. |
| Ingest LLM tagging slow/expensive | Only 120 open-ended rows; batch, use Haiku/Sonnet, cache results to a JSON so re-seeds are free. |
| Puppeteer on Vercel | v1 fallback = browser Print-to-PDF; harden after demo works. |
| Small cohorts → identifiable quotes | De-id rules from P0; aggregate < N, prefer `HEARTWARMING`-flagged quotes. |
| Demo flakiness (network/API) | Rehearse; keep a local run + recorded backup. |

---

## 6. Definition of done (demo)

A judge can: open the app → ask a plain-English quant question and get a grounded answer →
ask a qualitative question and get themes/quotes → request a dashboard, filter it live, ask a
follow-up that respects the filtered view → click "Generate impact report (funder)" and download
a PDF whose charts match the chat. Equity and facilitator-quality stories are visible in the data.
