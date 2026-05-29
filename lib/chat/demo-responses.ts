import type { UIMessage } from "ai";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SUGGESTED_PROMPTS, matchPillarPrompt, type Pillar } from "@/lib/chat/constants";
import type { DashboardSpec } from "@/lib/dashboard/types";

export function lastUserText(messages: UIMessage[] | undefined): string {
  if (!messages?.length) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    return m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();
  }
  return "";
}

export function matchSuggestedPrompt(text: string) {
  const t = text.trim();
  return SUGGESTED_PROMPTS.find((p) => p.prompt === t) ?? null;
}

type DemoPayload = {
  title: string;
  data: unknown;
  hint: string;
  dashboard?: DashboardSpec;
};

/** Pre-fetch SQL for landing-page sample prompts & pillar buttons. */
export async function loadDemoContext(userText: string): Promise<DemoPayload | null> {
  const pillar = matchPillarPrompt(userText);
  if (pillar) return loadPillarDemoContext(pillar);

  const match = matchSuggestedPrompt(userText);
  if (!match) return null;

  switch (match.title) {
    case "Trends": {
      const trend = await db.execute(sql`
        select to_char(w.date, 'YYYY') || ' Q' || extract(quarter from w.date)::int as term,
               round(avg(a.answer_value)::numeric, 2)::float as avg_likert,
               count(distinct s.id)::int as submissions
        from answers a
        join submissions s on a.submission_id = s.id
        join workshops w on s.workshop_id = w.id
        where a.answer_value is not null and w.date is not null
        group by term order by min(w.date)
      `);
      return {
        title: match.title,
        data: { trend },
        hint:
          "Summarise the term-on-term Likert trend. Note the dip in 2025 Q4 and recovery in 2026. " +
          "Use the exact averages from the data.",
      };
    }
    case "Dashboard": {
      const byPillar = await db.execute(sql`
        select w.topic as pillar, round(avg(a.answer_value)::numeric, 2)::float as avg_likert
        from answers a
        join submissions s on a.submission_id = s.id
        join workshops w on s.workshop_id = w.id
        where a.answer_value is not null
        group by w.topic order by avg_likert desc
      `);
      const bySchool = await db.execute(sql`
        select sc.name as school, round(avg(a.answer_value)::numeric, 2)::float as avg_likert
        from answers a
        join submissions s on a.submission_id = s.id
        join workshops w on s.workshop_id = w.id
        join schools sc on w.school_id = sc.id
        where a.answer_value is not null
        group by sc.name order by avg_likert desc limit 10
      `);
      const overall = await db.execute(sql`
        select round(avg(answer_value)::numeric, 2)::float as avg_likert,
               count(distinct submission_id)::int as submissions
        from answers where answer_value is not null
      `);
      const o = (overall as unknown as { avg_likert: number; submissions: number }[])[0];
      const spec: DashboardSpec = {
        title: "Outcomes by pillar & school",
        filters: [
          {
            id: "pillar",
            label: "Pillar",
            field: "pillar",
            options: (byPillar as unknown as { pillar: string }[]).map((r) => r.pillar),
            multi: true,
          },
        ],
        widgets: [
          {
            kind: "stat",
            label: "Overall avg rating",
            value: o?.avg_likert ?? "—",
            unit: "/5",
          },
          { kind: "stat", label: "Survey responses", value: o?.submissions ?? 0 },
          {
            kind: "bar",
            title: "Avg rating by pillar",
            x: "pillar",
            series: [{ key: "avg_likert", label: "Avg rating" }],
            data: byPillar as unknown as Record<string, string | number>[],
          },
          {
            kind: "bar",
            title: "Top schools by rating",
            x: "school",
            series: [{ key: "avg_likert", label: "Avg rating" }],
            data: bySchool as unknown as Record<string, string | number>[],
          },
        ],
      };
      return {
        title: match.title,
        data: { byPillar, bySchool, overall: o },
        hint:
          "Call make_dashboard with the provided dashboard spec (use these exact numbers). " +
          "Then write 2-3 sentences interpreting the chart.",
        dashboard: spec,
      };
    }
    case "Themes": {
      const themes = await db.execute(sql`
        select theme, count(*)::int as mentions
        from (select unnest(themes) as theme from answers where themes is not null) t
        group by theme order by mentions desc limit 10
      `);
      const samples = await db.execute(sql`
        select a.answer_text, a.sentiment, w.topic as pillar
        from answers a
        join submissions s on a.submission_id = s.id
        join workshops w on s.workshop_id = w.id
        where a.answer_value is null and a.themes is not null
        order by a.heartwarming desc nulls last
        limit 4
      `);
      return {
        title: match.title,
        data: { themes, sampleQuotes: samples },
        hint:
          "List the top themes with counts. Include 1-2 short verbatim quotes from sampleQuotes. " +
          "Prefer heartwarming quotes when present.",
      };
    }
    case "Risk": {
      const schools = await db.execute(sql`
        select sc.name as school,
               round(avg(a.answer_value)::numeric, 2)::float as avg_likert,
               count(distinct s.id)::int as submissions
        from answers a
        join submissions s on a.submission_id = s.id
        join workshops w on s.workshop_id = w.id
        join schools sc on w.school_id = sc.id
        where a.answer_value is not null
        group by sc.name
        having count(distinct s.id) >= 5
        order by avg_likert asc
        limit 5
      `);
      const compromised = await db.execute(sql`
        select w.code as workshop, sc.name as school, w.topic as pillar,
               w.if_compromised as issue
        from workshops w
        join schools sc on w.school_id = sc.id
        where w.was_compromised = true
        limit 8
      `);
      return {
        title: match.title,
        data: { lowestSchools: schools, compromisedWorkshops: compromised },
        hint:
          "Flag underperforming schools (lowest avg_likert) and compromised workshops. " +
          "Only mention schools with submissions >= 5. Be concrete with numbers.",
      };
    }
    case "Equity": {
      const icsea = await db.execute(sql`
        select case when sc.icsea_percentile < 34 then 'Lower ICSEA'
                    when sc.icsea_percentile < 67 then 'Mid ICSEA'
                    else 'Higher ICSEA' end as band,
               round(avg(a.answer_value)::numeric, 2)::float as avg_likert,
               count(distinct s.id)::int as submissions
        from answers a
        join submissions s on a.submission_id = s.id
        join workshops w on s.workshop_id = w.id
        join schools sc on w.school_id = sc.id
        where a.answer_value is not null and sc.icsea_percentile is not null
        group by band order by min(sc.icsea_percentile)
      `);
      const atsi = await db.execute(sql`
        select case when s.atsi then 'ATSI students' else 'Non-ATSI students' end as cohort,
               round(avg(a.answer_value)::numeric, 2)::float as avg_likert,
               count(distinct s.id)::int as submissions
        from answers a
        join submissions s on a.submission_id = s.id
        where a.answer_value is not null and s.atsi is not null
        group by s.atsi
      `);
      return {
        title: match.title,
        data: { icseaBands: icsea, atsiBreakdown: atsi },
        hint:
          "Compare outcomes by ICSEA band and ATSI cohort using aggregates only (de-identified). " +
          "Highlight where lower-advantage schools are performing relatively well or not.",
      };
    }
    default:
      return null;
  }
}

export function demoSystemContext(payload: DemoPayload): string {
  let block =
    `DEMO QUESTION (${payload.title}): Pre-loaded SQL results — use these exact numbers.\n` +
    `${payload.hint}\n\n` +
    `DATA:\n${JSON.stringify(payload.data, null, 2)}`;
  if (payload.dashboard) {
    block +=
      `\n\nDASHBOARD SPEC (pass to make_dashboard exactly):\n` +
      JSON.stringify(payload.dashboard, null, 2);
  }
  return block;
}

async function loadPillarDemoContext(pillar: Pillar): Promise<DemoPayload> {
  const [stats] = (await db.execute(sql`
    select count(distinct s.id)::int as submissions,
           count(distinct w.id)::int as workshops,
           round(avg(a.answer_value)::numeric, 2)::float as avg_likert
    from answers a
    join submissions s on a.submission_id = s.id
    join workshops w on s.workshop_id = w.id
    where a.answer_value is not null and w.topic = ${pillar}
  `)) as unknown as {
    submissions: number;
    workshops: number;
    avg_likert: number;
  }[];

  const vsAll = await db.execute(sql`
    select w.topic as pillar,
           round(avg(a.answer_value)::numeric, 2)::float as avg_likert,
           count(distinct s.id)::int as submissions
    from answers a
    join submissions s on a.submission_id = s.id
    join workshops w on s.workshop_id = w.id
    where a.answer_value is not null
    group by w.topic order by avg_likert desc
  `);

  const themes = await db.execute(sql`
    select theme, count(*)::int as mentions
    from (
      select unnest(a.themes) as theme
      from answers a
      join submissions s on a.submission_id = s.id
      join workshops w on s.workshop_id = w.id
      where w.topic = ${pillar} and a.themes is not null
    ) t
    group by theme order by mentions desc limit 8
  `);

  const trend = await db.execute(sql`
    select to_char(w.date, 'YYYY') || ' Q' || extract(quarter from w.date)::int as term,
           round(avg(a.answer_value)::numeric, 2)::float as avg_likert
    from answers a
    join submissions s on a.submission_id = s.id
    join workshops w on s.workshop_id = w.id
    where a.answer_value is not null and w.date is not null and w.topic = ${pillar}
    group by term order by min(w.date)
  `);

  const quotes = await db.execute(sql`
    select a.answer_text, a.sentiment
    from answers a
    join submissions s on a.submission_id = s.id
    join workshops w on s.workshop_id = w.id
    where w.topic = ${pillar} and a.answer_value is null and a.answer_text is not null
    order by a.heartwarming desc nulls last
    limit 3
  `);

  const spec: DashboardSpec = {
    title: `${pillar} pillar overview`,
    widgets: [
      {
        kind: "stat",
        label: `${pillar} avg rating`,
        value: stats?.avg_likert ?? "—",
        unit: "/5",
      },
      { kind: "stat", label: "Submissions", value: stats?.submissions ?? 0 },
      { kind: "stat", label: "Workshops", value: stats?.workshops ?? 0 },
      {
        kind: "bar",
        title: "All pillars compared",
        x: "pillar",
        series: [{ key: "avg_likert", label: "Avg rating" }],
        data: vsAll as unknown as Record<string, string | number>[],
      },
      {
        kind: "line",
        title: `${pillar} rating trend by term`,
        x: "term",
        series: [{ key: "avg_likert", label: "Avg rating" }],
        data: trend as unknown as Record<string, string | number>[],
      },
      {
        kind: "bar",
        title: "Top feedback themes",
        x: "theme",
        series: [{ key: "mentions", label: "Mentions" }],
        data: themes as unknown as Record<string, string | number>[],
      },
    ],
  };

  return {
    title: `${pillar} pillar`,
    data: {
      pillar,
      stats,
      comparisonAcrossPillars: vsAll,
      themes,
      trend,
      sampleQuotes: quotes,
    },
    hint:
      `Focus on the ${pillar} pillar only. Summarise average ratings, how ${pillar} ranks vs other pillars, ` +
      `top open-ended themes, and the term trend. You may quote 1 sample comment if helpful (de-identified). ` +
      `Call make_dashboard with the provided dashboard spec.`,
    dashboard: spec,
  };
}
