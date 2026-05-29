/**
 * Seed: parse the flat CSV export → normalised Postgres tables, enriching the
 * open-ended answers with Claude sentiment/themes + OpenAI embeddings (cached).
 *
 * Run: npm run seed   (needs DIRECT_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY in .env)
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { parse } from "csv-parse/sync";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateObject, embedMany } from "ai";
import { z } from "zod";
import * as schema from "../lib/db/schema";

// ─── parsing helpers ───
const truthy = (v?: string) => {
  const t = v?.trim().toUpperCase();
  return t === "TRUE" || t === "YES";
};
const intOrNull = (v?: string) => (v?.trim() ? parseInt(v, 10) : null);
const amountCents = (v?: string) => {
  const n = v?.replace(/[$,]/g, "").trim();
  return n ? Math.round(parseFloat(n) * 100) : null;
};
const isoDate = (v?: string) => {
  if (!v?.trim()) return null;
  const [d, m, y] = v.trim().split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};
const dateTime = (v?: string) => {
  if (!v?.trim()) return null;
  const [dpart, tpart] = v.trim().split(" ");
  const [d, m, y] = dpart.split("/");
  const [hh, mm] = (tpart || "00:00").split(":");
  return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm));
};
const hash = (s: string) => createHash("sha1").update(s).digest("hex");

type Row = Record<string, string>;

// ─── enrichment cache ───
type Enrichment = { sentiment: string; themes: string[]; embedding: number[] };
const CACHE_PATH = path.join(process.cwd(), "data", "enrichment-cache.json");
const cache: Record<string, Enrichment> = existsSync(CACHE_PATH)
  ? JSON.parse(readFileSync(CACHE_PATH, "utf8"))
  : {};

const sentimentSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      sentiment: z.enum(["positive", "neutral", "negative"]),
      themes: z.array(z.string()).max(3),
    }),
  ),
});

async function enrich(texts: string[]) {
  const todo = texts.filter((t) => !cache[hash(t)]);
  if (todo.length === 0) return;
  console.log(`Enriching ${todo.length} new open-ended answers…`);

  // 1) Sentiment + themes (Claude Haiku), batched.
  const batchSize = 25;
  const tags: Record<string, { sentiment: string; themes: string[] }> = {};
  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    const list = batch.map((t, j) => `${j}. ${t}`).join("\n");
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: sentimentSchema,
      prompt:
        "You are tagging short student feedback comments from youth wellbeing workshops. " +
        "For each numbered comment, give a sentiment (positive/neutral/negative) and 1-3 short " +
        "lowercase theme tags (e.g. confidence, connection, wellbeing, stress, facilitator, " +
        "engagement, purpose, friendship, goals).\n\n" +
        list,
    });
    for (const r of object.results) {
      const text = batch[r.index];
      if (text) tags[text] = { sentiment: r.sentiment, themes: r.themes };
    }
  }

  // 2) Embeddings (OpenAI), one batched call.
  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: todo,
  });

  todo.forEach((t, i) => {
    cache[hash(t)] = {
      sentiment: tags[t]?.sentiment ?? "neutral",
      themes: tags[t]?.themes ?? [],
      embedding: embeddings[i],
    };
  });
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is not set");
const client = postgres(url, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

async function chunkedInsert<T>(
  table: Parameters<typeof db.insert>[0],
  values: T[],
  onConflict: "nothing" | "updateAnswer" = "nothing",
) {
  const size = 200;
  for (let i = 0; i < values.length; i += size) {
    const slice = values.slice(i, i + size);
    if (slice.length === 0) continue;
    const q = db.insert(table).values(slice as never);
    if (onConflict === "nothing") await q.onConflictDoNothing();
    else
      await q.onConflictDoUpdate({
        target: schema.answers.id,
        set: {
          sentiment: sql`excluded.sentiment`,
          themes: sql`excluded.themes`,
          embedding: sql`excluded.embedding`,
        },
      });
  }
}

async function main() {
  const raw = readFileSync(
    path.join(process.cwd(), "data", "LifeChanger_Workshop_Feedback.csv"),
    "utf8",
  ).replace(/^\uFEFF/, "");
  const rows = parse(raw, {
        columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];
  console.log(`Parsed ${rows.length} rows.`);

  // ── dedupe dimension tables ──
  const schools = new Map<string, typeof schema.schools.$inferInsert>();
  const agreements = new Map<string, typeof schema.agreements.$inferInsert>();
  const workshops = new Map<string, typeof schema.workshops.$inferInsert>();
  const submissions = new Map<string, typeof schema.submissions.$inferInsert>();
  const answers: (typeof schema.answers.$inferInsert)[] = [];

  for (const r of rows) {
    if (!schools.has(r.SCHOOL_ACCOUNT_ID)) {
      schools.set(r.SCHOOL_ACCOUNT_ID, {
        id: r.SCHOOL_ACCOUNT_ID,
        name: r.SCHOOL_NAME,
        state: r.SCHOOL_STATE,
        region: r.SCHOOL_REGION,
        lat: r.SCHOOL_GEOLOCATION_LATITUDE ? Number(r.SCHOOL_GEOLOCATION_LATITUDE) : null,
        lng: r.SCHOOL_GEOLOCATION_LONGITUDE ? Number(r.SCHOOL_GEOLOCATION_LONGITUDE) : null,
        icseaPercentile: intOrNull(r.SCHOOL_ICSEA_PERCENTILE),
        enrolments: intOrNull(r.SCHOOL_NUMBER_OF_ENROLEMENTS),
      });
    }
    if (r.SCHOOL_AGREEMENT_OPPORTUNITY_ID && !agreements.has(r.SCHOOL_AGREEMENT_OPPORTUNITY_ID)) {
      agreements.set(r.SCHOOL_AGREEMENT_OPPORTUNITY_ID, {
        id: r.SCHOOL_AGREEMENT_OPPORTUNITY_ID,
        schoolId: r.SCHOOL_ACCOUNT_ID,
        name: r.SCHOOL_AGREEMENT_NAME,
        stage: r.SCHOOL_AGREEMENT_STAGE,
        closeDate: isoDate(r.SCHOOL_AGREEMENT_CLOSE_DATE),
        amountCents: amountCents(r.SCHOOL_AGREEMENT_AMOUNT),
      });
    }
    if (!workshops.has(r.WORKSHOP_SF_ID)) {
      workshops.set(r.WORKSHOP_SF_ID, {
        id: r.WORKSHOP_SF_ID,
        code: r.WORKSHOP_CODE,
        topic: r.WORKSHOP_TOPIC,
        region: r.WORKSHOP_REGION,
        location: r.WORKSHOP_LOCATION,
        date: isoDate(r.WORKSHOP_DATE),
        startTime: r.WORKSHOP_START_TIME,
        endTime: r.WORKSHOP_END_TIME,
        schoolId: r.SCHOOL_ACCOUNT_ID,
        leadFacilitator: r.LEAD_FACILITATOR,
        facilitatorsList: r.FACILITATORS_LIST,
        mentorsList: r.MENTORS_LIST,
        numberOfStudents: intOrNull(r.NUMBER_OF_STUDENTS),
        facilitatorRating: intOrNull(r.FACILITATOR_WORKSHOP_RATING),
        wasCompromised: truthy(r.WAS_WORKSHOP_COMPROMISED),
        ifCompromised: r.IF_COMPROMISED_WHAT_HAPPENED || null,
        didDeviate: truthy(r.DID_WORKSHOP_DEVIATE),
        ifDeviated: r.IF_DEVIATED_WHAT_WAS_DIFFERENT || null,
        workshopGems: r.WORKSHOP_GEMS || null,
        anythingElse: r.ANYTHING_ELSE_TO_NOTE || null,
      });
    }
    if (!submissions.has(r.SUBMISSION_ID)) {
      submissions.set(r.SUBMISSION_ID, {
        id: r.SUBMISSION_ID,
        workshopId: r.WORKSHOP_SF_ID,
        yearLevel: intOrNull(r.YEAR_LEVEL),
        atsi: truthy(r.ATSI_IDENTIFICATION),
        gender: r.GENDER,
        submittedOn: dateTime(r.SUBMITTED_ON),
      });
    }
    answers.push({
      id: `${r.SUBMISSION_ID}_${r.QUESTION_ID}`,
      submissionId: r.SUBMISSION_ID,
      questionId: r.QUESTION_ID,
      questionText: r.QUESTION_TEXT,
      answerText: r.ANSWER_TEXT,
      answerValue: intOrNull(r.ANSWER_VALUE),
      heartwarming: truthy(r.HEARTWARMING),
    });
  }

  // ── enrich open-ended answers (no Likert value) ──
  const openTexts = [
    ...new Set(answers.filter((a) => a.answerValue == null && a.answerText).map((a) => a.answerText as string)),
  ];
  try {
    await enrich(openTexts);
    for (const a of answers) {
      if (a.answerValue == null && a.answerText) {
        const e = cache[hash(a.answerText)];
        if (e) {
          a.sentiment = e.sentiment;
          a.themes = e.themes;
          a.embedding = e.embedding;
        }
      }
    }
  } catch (err) {
    console.error("Enrichment failed — inserting rows without it:", (err as Error).message);
  }

  // ── insert (FK order) ──
  await chunkedInsert(schema.schools, [...schools.values()]);
  await chunkedInsert(schema.agreements, [...agreements.values()]);
  await chunkedInsert(schema.workshops, [...workshops.values()]);
  await chunkedInsert(schema.submissions, [...submissions.values()]);
  await chunkedInsert(schema.answers, answers, "updateAnswer");

  console.log(
    `Seeded: ${schools.size} schools · ${agreements.size} agreements · ${workshops.size} workshops · ${submissions.size} submissions · ${answers.length} answers.`,
  );
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
