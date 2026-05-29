import { tool } from "ai";
import { z } from "zod";
import { sql, cosineDistance, isNotNull, eq } from "drizzle-orm";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import { answers, submissions, workshops, schools } from "@/lib/db/schema";
import { EMBEDDING_MODEL } from "@/lib/ai/models";
import { dashboardSpec } from "@/lib/dashboard/types";

const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|merge|vacuum)\b/i;

/** Allow exactly one read-only SELECT/CTE statement. */
function sanitizeSelect(query: string): string {
  const s = query.trim().replace(/;+\s*$/, "");
  if (s.includes(";")) throw new Error("Only a single SQL statement is allowed.");
  if (!/^(select|with)\b/i.test(s)) throw new Error("Only SELECT queries are allowed.");
  if (FORBIDDEN.test(s)) throw new Error("Only read-only queries are allowed.");
  return s;
}

export const queryData = tool({
  description:
    "Run ONE read-only Postgres SELECT against the program data (schools, agreements, " +
    "workshops, submissions, answers). Use for quantitative questions: averages of answer_value, " +
    "counts, trends over workshops.date, group-by topic/school/term, facilitator and equity breakdowns.",
  inputSchema: z.object({
    sql: z.string().describe("A single read-only Postgres SELECT statement."),
    purpose: z.string().optional().describe("Short description of what this query answers."),
  }),
  execute: async ({ sql: query }) => {
    const safe = sanitizeSelect(query);
    // Cap rows and never return raw embeddings.
    const wrapped = `select * from (${safe}) as _q limit 500`;
    const rows = (await db.execute(sql.raw(wrapped))) as Record<string, unknown>[];
    const cleaned = rows.map((r) => {
      const { embedding, ...rest } = r;
      void embedding;
      return rest;
    });
    return { rowCount: cleaned.length, rows: cleaned };
  },
});

export const searchFeedback = tool({
  description:
    "Semantic search over students' open-ended answer text. Use for qualitative questions: " +
    "themes, sentiment, representative quotes, and stories. Returns the most relevant comments " +
    "with their workshop topic, school, sentiment and themes.",
  inputSchema: z.object({
    query: z.string().describe("What to search for, e.g. 'confidence and self-belief stories'."),
    limit: z.number().min(1).max(20).default(8),
  }),
  execute: async ({ query, limit }) => {
    const { embedding } = await embed({
      model: openai.embedding(EMBEDDING_MODEL),
      value: query,
    });
    const distance = cosineDistance(answers.embedding, embedding);
    const rows = await db
      .select({
        answerText: answers.answerText,
        questionText: answers.questionText,
        sentiment: answers.sentiment,
        themes: answers.themes,
        heartwarming: answers.heartwarming,
        topic: workshops.topic,
        school: schools.name,
        similarity: sql<number>`1 - (${distance})`,
      })
      .from(answers)
      .innerJoin(submissions, eq(answers.submissionId, submissions.id))
      .innerJoin(workshops, eq(submissions.workshopId, workshops.id))
      .innerJoin(schools, eq(workshops.schoolId, schools.id))
      .where(isNotNull(answers.embedding))
      .orderBy(distance)
      .limit(limit);
    return { count: rows.length, results: rows };
  },
});

export const makeDashboard = tool({
  description:
    "Render an inline dashboard for the user. First gather the numbers with query_data, then call " +
    "this with the computed widgets. Compose from: stat (KPI tile), line (trend), bar (comparison), " +
    "pie (composition), table. Add filters (e.g. by state or topic) whose `field` matches a key in " +
    "the widget data rows. Keep data compact (top-N, labeled).",
  inputSchema: dashboardSpec,
  execute: async (spec) => {
    const dashboardId = `dsh_${Math.random().toString(36).slice(2, 10)}`;
    return { dashboardId, spec };
  },
});

export const chatTools = {
  query_data: queryData,
  search_feedback: searchFeedback,
  make_dashboard: makeDashboard,
};
