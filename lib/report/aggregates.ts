import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Widget } from "@/lib/dashboard/types";

type Num = number;

/**
 * Deterministic program aggregates computed in SQL, plus pre-built chart widgets
 * (correct numbers — the LLM only writes narrative and chooses which to include).
 */
export async function gatherAggregates() {
  const [overall] = (await db.execute(sql`
    select
      (select count(distinct id) from submissions)::int as submissions,
      (select count(distinct id) from workshops)::int as workshops,
      (select count(distinct id) from schools)::int as schools,
      (select round(avg(answer_value)::numeric, 2)::float from answers where answer_value is not null) as avg_likert
  `)) as unknown as { submissions: Num; workshops: Num; schools: Num; avg_likert: Num }[];

  const byPillar = (await db.execute(sql`
    select w.topic as topic, round(avg(a.answer_value)::numeric, 2)::float as avg
    from answers a
    join submissions s on a.submission_id = s.id
    join workshops w on s.workshop_id = w.id
    where a.answer_value is not null
    group by w.topic order by avg desc
  `)) as unknown as { topic: string; avg: Num }[];

  const trend = (await db.execute(sql`
    select to_char(w.date, 'YYYY') || ' Q' || extract(quarter from w.date)::int as term,
           round(avg(a.answer_value)::numeric, 2)::float as avg,
           min(w.date) as sortd
    from answers a
    join submissions s on a.submission_id = s.id
    join workshops w on s.workshop_id = w.id
    where a.answer_value is not null and w.date is not null
    group by term order by sortd
  `)) as unknown as { term: string; avg: Num }[];

  const sentiment = (await db.execute(sql`
    select sentiment, count(*)::int as count
    from answers where sentiment is not null
    group by sentiment
  `)) as unknown as { sentiment: string; count: Num }[];

  const themes = (await db.execute(sql`
    select theme, count(*)::int as count
    from (select unnest(themes) as theme from answers where themes is not null) t
    group by theme order by count desc limit 8
  `)) as unknown as { theme: string; count: Num }[];

  const equity = (await db.execute(sql`
    select case when sc.icsea_percentile < 34 then 'Lower advantage'
                when sc.icsea_percentile < 67 then 'Mid'
                else 'Higher advantage' end as band,
           round(avg(a.answer_value)::numeric, 2)::float as avg,
           min(sc.icsea_percentile) as sortk
    from answers a
    join submissions s on a.submission_id = s.id
    join workshops w on s.workshop_id = w.id
    join schools sc on w.school_id = sc.id
    where a.answer_value is not null and sc.icsea_percentile is not null
    group by band order by sortk
  `)) as unknown as { band: string; avg: Num }[];

  const quotes = (await db.execute(sql`
    select a.answer_text as text, w.topic as topic
    from answers a
    join submissions s on a.submission_id = s.id
    join workshops w on s.workshop_id = w.id
    where a.heartwarming = true and a.answer_value is null and a.answer_text is not null
    limit 6
  `)) as unknown as { text: string; topic: string }[];

  const totalSent = sentiment.reduce((n, r) => n + r.count, 0) || 1;
  const positivePct = Math.round(
    ((sentiment.find((r) => r.sentiment === "positive")?.count ?? 0) / totalSent) * 100,
  );

  const widgets: Widget[] = [
    { kind: "stat", id: "kpi-avg", label: "Avg workshop rating", value: overall.avg_likert, unit: "/5" },
    { kind: "stat", id: "kpi-subs", label: "Survey responses", value: overall.submissions },
    { kind: "stat", id: "kpi-workshops", label: "Workshops", value: overall.workshops },
    { kind: "stat", id: "kpi-schools", label: "Partner schools", value: overall.schools },
    { kind: "stat", id: "kpi-positive", label: "Positive sentiment", value: positivePct, unit: "%" },
    {
      kind: "line",
      id: "trend",
      title: "Average rating over time",
      x: "term",
      series: [{ key: "avg", label: "Avg rating" }],
      data: trend,
    },
    {
      kind: "bar",
      id: "pillars",
      title: "Average rating by pillar",
      x: "topic",
      series: [{ key: "avg", label: "Avg rating" }],
      data: byPillar,
    },
    {
      kind: "pie",
      id: "sentiment",
      title: "Feedback sentiment",
      nameKey: "sentiment",
      valueKey: "count",
      data: sentiment,
    },
    {
      kind: "bar",
      id: "equity",
      title: "Rating by school advantage (ICSEA)",
      x: "band",
      series: [{ key: "avg", label: "Avg rating" }],
      data: equity,
    },
    {
      kind: "bar",
      id: "themes",
      title: "Most common feedback themes",
      x: "theme",
      series: [{ key: "count", label: "Mentions" }],
      data: themes,
    },
  ];

  const summary = { overall, byPillar, trend, sentiment, themes, equity, positivePct };
  return { widgets, quotes, summary };
}
