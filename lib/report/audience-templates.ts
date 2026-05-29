import type { Audience } from "@/lib/report/types";
import type { Widget } from "@/lib/dashboard/types";

/** What each audience cares about — CEO / impact framing. */
export type AudienceTemplate = {
  audience: Audience;
  reportTitle: string;
  subtitle: string;
  tagline: string;
  accentLabel: string;
  /** Section headings the narrative must cover (in order). */
  sectionBlueprint: {
    heading: string;
    focus: string;
    /** Aggregate widget ids to attach when available. */
    widgetIds: string[];
  }[];
  /** KPI stat widget ids for the hero strip. */
  heroWidgetIds: string[];
};

export const AUDIENCE_TEMPLATES: Record<Audience, AudienceTemplate> = {
  funder: {
    audience: "funder",
    reportTitle: "Impact & reach report",
    subtitle: "Evidence for partners and funders",
    tagline: "Scale · outcomes · equity · value",
    accentLabel: "For funders",
    heroWidgetIds: ["kpi-subs", "kpi-workshops", "kpi-avg", "kpi-positive"],
    sectionBlueprint: [
      {
        heading: "Program reach at a glance",
        focus:
          "Lead with scale: survey responses, workshops delivered, schools reached. " +
          "Frame as breadth of impact and reliable data collection.",
        widgetIds: ["kpi-subs", "kpi-workshops", "kpi-schools"],
      },
      {
        heading: "Measurable student outcomes",
        focus:
          "Average Likert rating (/5), term-on-term trend, pillar comparison. " +
          "Emphasise evidence and consistency — funders need numbers they can cite.",
        widgetIds: ["kpi-avg", "trend", "pillars"],
      },
      {
        heading: "Equity & access",
        focus:
          "ICSEA / school-advantage bands — are lower-advantage schools reached and benefiting? " +
          "This is often a funder priority.",
        widgetIds: ["equity"],
      },
      {
        heading: "What students are saying",
        focus:
          "Sentiment mix and top themes — qualitative proof that complements the ratings. " +
          "Use quotes sparingly; de-identified only.",
        widgetIds: ["sentiment", "themes"],
      },
      {
        heading: "Investment narrative",
        focus:
          "2–3 sentences on value for money, replicability, and what continued investment enables. " +
          "Confident, evidence-led — no hype without data.",
        widgetIds: [],
      },
    ],
  },
  school: {
    audience: "school",
    reportTitle: "Student wellbeing & engagement report",
    subtitle: "For partner schools and wellbeing teams",
    tagline: "Student voice · pillar growth · partnership value",
    accentLabel: "For schools",
    heroWidgetIds: ["kpi-avg", "kpi-positive", "kpi-subs"],
    sectionBlueprint: [
      {
        heading: "What your students experienced",
        focus:
          "Warm, concrete opening: workshops delivered, students who responded, overall rating. " +
          "Speak to a principal or wellbeing lead.",
        widgetIds: ["kpi-subs", "kpi-workshops"],
      },
      {
        heading: "Wellbeing outcomes by pillar",
        focus:
          "HEALTH, SELF, SKILLS, PURPOSE, TRIBE — which pillars scored highest and what that means " +
          "for student wellbeing in plain language.",
        widgetIds: ["pillars", "kpi-avg"],
      },
      {
        heading: "How students felt",
        focus:
          "Sentiment breakdown and emerging themes from open-ended feedback. " +
          "Foreground engagement and belonging.",
        widgetIds: ["sentiment", "themes"],
      },
      {
        heading: "In students' own words",
        focus:
          "2–4 short quotes (de-identified). Heartwarming or constructive — show the human impact.",
        widgetIds: [],
      },
      {
        heading: "Trends over time",
        focus:
          "Term-on-term rating trend — is the partnership improving? Note dips and recovery honestly.",
        widgetIds: ["trend"],
      },
      {
        heading: "Continuing the partnership",
        focus:
          "1–2 practical suggestions: which pillars to deepen, how Lifechanger supports your goals.",
        widgetIds: [],
      },
    ],
  },
  board: {
    audience: "board",
    reportTitle: "Strategic performance brief",
    subtitle: "For the Lifechanger board & leadership",
    tagline: "Trends · risks · equity · priorities",
    accentLabel: "Internal / board",
    heroWidgetIds: ["kpi-avg", "kpi-subs", "kpi-workshops", "kpi-positive"],
    sectionBlueprint: [
      {
        heading: "Executive snapshot",
        focus:
          "One paragraph: overall rating, response volume, headline trend direction. " +
          "Decision-useful — no fluff.",
        widgetIds: ["kpi-avg", "kpi-subs", "trend"],
      },
      {
        heading: "Performance trends",
        focus:
          "Term-on-term Likert trend — call out dips (e.g. Q4) and recovery. " +
          "Board needs to see trajectory, not just a point estimate.",
        widgetIds: ["trend"],
      },
      {
        heading: "Pillar portfolio",
        focus:
          "Which pillars over/under-perform vs average? Strategic implications for program design.",
        widgetIds: ["pillars"],
      },
      {
        heading: "Equity & delivery risk",
        focus:
          "ICSEA bands — gaps between lower- and higher-advantage schools. " +
          "Flag under-performance or uneven reach as risks.",
        widgetIds: ["equity"],
      },
      {
        heading: "Qualitative signals",
        focus:
          "Sentiment and theme concentration — early warnings or strengths in student voice data.",
        widgetIds: ["sentiment", "themes"],
      },
      {
        heading: "Board priorities (next 90 days)",
        focus:
          "Exactly 2–3 numbered priorities grounded in the data above. Action-oriented.",
        widgetIds: [],
      },
    ],
  },
};

export function templateSectionPrompt(audience: Audience): string {
  const t = AUDIENCE_TEMPLATES[audience];
  const lines = t.sectionBlueprint.map(
    (s, i) =>
      `${i + 1}. "${s.heading}" — ${s.focus}` +
      (s.widgetIds.length ? ` [charts: ${s.widgetIds.join(", ")}]` : ""),
  );
  return (
    `Report type: ${t.reportTitle}\n` +
    `Use these sections IN ORDER (you may merge adjacent sections if the chat is thin, but keep headings):\n` +
    lines.join("\n")
  );
}

export function pickWidgetsForAudience(
  allWidgets: Widget[],
  audience: Audience,
): Widget[] {
  const ids = new Set<string>();
  const t = AUDIENCE_TEMPLATES[audience];
  for (const id of t.heroWidgetIds) ids.add(id);
  for (const s of t.sectionBlueprint) {
    for (const id of s.widgetIds) ids.add(id);
  }
  const byId = new Map(allWidgets.map((w) => [w.id ?? "", w]));
  const picked: Widget[] = [];
  for (const id of ids) {
    const w = byId.get(id);
    if (w) picked.push(w);
  }
  for (const w of allWidgets) {
    if (w.id && !ids.has(w.id)) picked.push(w);
  }
  return picked.length ? picked : allWidgets;
}
