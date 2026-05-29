import type { Audience, ReportSpec } from "@/lib/report/types";
import { AUDIENCE_TEMPLATES } from "@/lib/report/audience-templates";
import { gatherAggregates } from "@/lib/report/aggregates";
import { pickWidgetsForAudience } from "@/lib/report/audience-templates";

type Summary = Awaited<ReturnType<typeof gatherAggregates>>["summary"];

function fmt(n: number | undefined, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function topPillar(byPillar: { topic: string; avg: number }[]) {
  return byPillar[0]?.topic ?? "—";
}

function lowestPillar(byPillar: { topic: string; avg: number }[]) {
  return byPillar.length ? byPillar[byPillar.length - 1].topic : "—";
}

function trendDirection(trend: { term: string; avg: number }[]) {
  if (trend.length < 2) return "insufficient data";
  const first = trend[0].avg;
  const last = trend[trend.length - 1].avg;
  const diff = last - first;
  if (diff > 0.05) return "improving";
  if (diff < -0.05) return "declining";
  return "stable";
}

function buildSections(audience: Audience, s: Summary, quotes: { text: string; topic: string }[]) {
  const { overall, byPillar, trend, positivePct, equity } = s;
  const o = overall;
  const dir = trendDirection(trend as { term: string; avg: number }[]);
  const latestTerm = trend.length ? (trend[trend.length - 1] as { term: string }).term : "—";
  const equityGap =
    equity.length >= 2
      ? Math.abs(
          (equity[equity.length - 1] as { avg: number }).avg -
            (equity[0] as { avg: number }).avg,
        ).toFixed(2)
      : "—";

  const quoteBlock =
    quotes.length > 0
      ? quotes
          .slice(0, 3)
          .map((q) => `"${q.text.slice(0, 200)}${q.text.length > 200 ? "…" : ""}" (${q.topic})`)
          .join("\n\n")
      : "No verbatim quotes in the current sample.";

  const blueprint = AUDIENCE_TEMPLATES[audience].sectionBlueprint;

  const bodies: Record<Audience, Record<string, string>> = {
    funder: {
      "Program reach at a glance": `Lifechanger captured **${o.submissions}** student survey responses across **${o.workshops}** workshops and **${o.schools}** partner schools in the current dataset. This demonstrates consistent post-workshop data collection at scale — a foundation funders can rely on for impact reporting.`,
      "Measurable student outcomes": `The program-wide average workshop rating is **${fmt(o.avg_likert)} / 5**. Trend direction is **${dir}** (latest term: ${latestTerm}). **${topPillar(byPillar as { topic: string; avg: number }[])}** leads among pillars; **${lowestPillar(byPillar as { topic: string; avg: number }[])}** is the focus area for uplift.`,
      "Equity & access": `Ratings are reported by school advantage band (ICSEA). The gap between highest and lowest bands in this sample is **${equityGap}** points on the 5-point scale. Funders should note whether lower-advantage schools are reached in proportion to mission.`,
      "What students are saying": `**${positivePct}%** of coded open-ended responses are positive in sentiment. Theme analysis highlights what students value most — complementing the Likert scores with qualitative proof of engagement.`,
      "Investment narrative": `Continued investment supports measurable wellbeing outcomes, equity-focused delivery, and a growing evidence base (${o.submissions} responses and counting). The data supports a credible story of scale with room to deepen impact in under-performing pillars.`,
    },
    school: {
      "What your students experienced": `Your students contributed **${o.submissions}** survey responses after Lifechanger workshops. The overall experience rating is **${fmt(o.avg_likert)} / 5** — a strong signal of engagement when students feel heard after a session.`,
      "Wellbeing outcomes by pillar": `Workshops span five pillars. **${topPillar(byPillar as { topic: string; avg: number }[])}** shows the highest average rating in this cohort; **${lowestPillar(byPillar as { topic: string; avg: number }[])}** may benefit from follow-up wellbeing activities. Each pillar targets a different dimension of student growth.`,
      "How students felt": `**${positivePct}%** of open-ended feedback is positive. Common themes reflect belonging, self-awareness, and practical skills — the outcomes schools care about for wellbeing plans.`,
      "In students' own words": quoteBlock,
      "Trends over time": `Ratings are **${dir}** across terms in the dataset (latest: ${latestTerm}). Share this with your wellbeing team when planning the next workshop cycle.`,
      "Continuing the partnership": `Consider doubling down on **${topPillar(byPillar as { topic: string; avg: number }[])}** strengths while scheduling support for **${lowestPillar(byPillar as { topic: string; avg: number }[])}**. Lifechanger can tailor facilitator briefings to your school's goals.`,
    },
    board: {
      "Executive snapshot": `**${fmt(o.avg_likert)} / 5** average rating · **${o.submissions}** responses · **${o.workshops}** workshops · trend **${dir}**. Latest term: ${latestTerm}.`,
      "Performance trends": `Term-on-term averages show a **${dir}** trajectory. Review Q4 dips and recovery patterns before the next board cycle — delivery timing and facilitator load may explain variance.`,
      "Pillar portfolio": `Top pillar: **${topPillar(byPillar as { topic: string; avg: number }[])}**. Weakest: **${lowestPillar(byPillar as { topic: string; avg: number }[])}**. Align facilitator training and content updates to close the spread.`,
      "Equity & delivery risk": `ICSEA band gap: **${equityGap}** rating points. If lower-advantage schools underperform, flag for program equity review.`,
      "Qualitative signals": `${positivePct}% positive sentiment. Monitor theme concentration for early warnings (e.g. disengagement, anxiety) alongside Likert trends.`,
      "Board priorities (next 90 days)": `1. Close the pillar gap — uplift **${lowestPillar(byPillar as { topic: string; avg: number }[])}** through targeted content.\n2. Investigate term dips in the trend chart and stabilise Q4 delivery.\n3. Report equity outcomes explicitly to funders using ICSEA band data.`,
    },
  };

  return blueprint.map((bp) => ({
    heading: bp.heading,
    body: bodies[audience][bp.heading] ?? bp.focus,
    widgetIds: bp.widgetIds,
  }));
}

function executiveSummary(audience: Audience, s: Summary): string {
  const { overall, positivePct } = s;
  const o = overall;
  switch (audience) {
    case "funder":
      return (
        `Lifechanger delivered ${o.workshops} workshops with ${o.submissions} student responses ` +
        `across ${o.schools} schools. Average rating ${fmt(o.avg_likert)}/5 with ${positivePct}% ` +
        `positive qualitative feedback — evidence of scale, outcomes, and student engagement suitable for funder reporting.`
      );
    case "school":
      return (
        `Students rated Lifechanger workshops ${fmt(o.avg_likert)}/5 on average, with ${positivePct}% ` +
        `of open-ended feedback positive. This report summarises pillar outcomes, themes, and student ` +
        `voices to support your school's wellbeing planning.`
      );
    case "board":
      return (
        `Program average ${fmt(o.avg_likert)}/5 · ${o.submissions} responses · ${o.workshops} workshops. ` +
        `Trend ${trendDirection(s.trend as { term: string; avg: number }[])}. ` +
        `Review pillar spread, equity bands, and qualitative signals for strategic decisions.`
      );
  }
}

function keyTakeaways(audience: Audience, s: Summary): string[] {
  const { overall, byPillar, positivePct } = s;
  const top = topPillar(byPillar as { topic: string; avg: number }[]);
  const low = lowestPillar(byPillar as { topic: string; avg: number }[]);
  switch (audience) {
    case "funder":
      return [
        `${overall.submissions} survey responses — strong evidence base for impact claims`,
        `${fmt(overall.avg_likert)}/5 average rating across all workshops`,
        `${positivePct}% positive sentiment in student voice data`,
        `${top} pillar leads; equity bands should be highlighted in grant reports`,
      ];
    case "school":
      return [
        `Students rate workshops ${fmt(overall.avg_likert)}/5 on average`,
        `${top} is the strongest pillar for your cohort`,
        `${positivePct}% of feedback is positive — engagement is high`,
        `Use student quotes in wellbeing committee updates`,
      ];
    case "board":
      return [
        `Headline rating ${fmt(overall.avg_likert)}/5 across ${overall.workshops} workshops`,
        `Pillar gap: ${top} (high) vs ${low} (focus area)`,
        `Trend ${trendDirection(s.trend as { term: string; avg: number }[])} — monitor Q4 delivery`,
        `Prioritise equity review if ICSEA bands diverge`,
      ];
  }
}

/** Deterministic preview report from live aggregates — no LLM required. */
export async function buildPreviewReport(audience: Audience): Promise<ReportSpec> {
  const { widgets, quotes, summary } = await gatherAggregates();
  const template = AUDIENCE_TEMPLATES[audience];

  return {
    audience,
    title: template.reportTitle,
    subtitle: template.subtitle,
    executiveSummary: executiveSummary(audience, summary),
    keyTakeaways: keyTakeaways(audience, summary),
    sections: buildSections(audience, summary, quotes),
    generatedAt: new Date().toISOString(),
    widgets: pickWidgetsForAudience(widgets, audience),
    quotes,
  };
}
