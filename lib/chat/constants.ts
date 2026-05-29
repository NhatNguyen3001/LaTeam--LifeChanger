/** Demo prompts aligned with the P0 demo script (trend → dashboard → qual → risk → equity). */
export const SUGGESTED_PROMPTS = [
  {
    title: "Trends",
    prompt: "How are workshop Likert ratings trending over time by term?",
  },
  {
    title: "Dashboard",
    prompt: "Show me a dashboard of outcomes by pillar and school.",
  },
  {
    title: "Themes",
    prompt: "What themes show up in students' open-ended feedback?",
  },
  {
    title: "Risk",
    prompt: "Which schools or workshops look underperforming or compromised?",
  },
  {
    title: "Equity",
    prompt: "How do outcomes differ by ICSEA band and ATSI participation?",
  },
] as const;

export const PILLARS = ["HEALTH", "SELF", "SKILLS", "PURPOSE", "TRIBE"] as const;
export type Pillar = (typeof PILLARS)[number];

/** Tailored questions per Lifechanger workshop pillar (maps to workshops.topic). */
export const PILLAR_INSIGHTS: Record<
  Pillar,
  { blurb: string; prompt: string }
> = {
  HEALTH: {
    blurb: "Physical & mental wellbeing",
    prompt:
      "Analyze HEALTH pillar workshops: average Likert scores, top themes in open-ended feedback, how HEALTH compares to other pillars, and rating trends over time.",
  },
  SELF: {
    blurb: "Identity, confidence & emotions",
    prompt:
      "Analyze SELF pillar workshops: average Likert scores, top themes in open-ended feedback, how SELF compares to other pillars, and rating trends over time.",
  },
  SKILLS: {
    blurb: "Learning, goals & capability",
    prompt:
      "Analyze SKILLS pillar workshops: average Likert scores, top themes in open-ended feedback, how SKILLS compares to other pillars, and rating trends over time.",
  },
  PURPOSE: {
    blurb: "Direction, motivation & future",
    prompt:
      "Analyze PURPOSE pillar workshops: average Likert scores, top themes in open-ended feedback, how PURPOSE compares to other pillars, and rating trends over time.",
  },
  TRIBE: {
    blurb: "Connection, belonging & community",
    prompt:
      "Analyze TRIBE pillar workshops: average Likert scores, top themes in open-ended feedback, how TRIBE compares to other pillars, and rating trends over time.",
  },
};

export function matchPillarPrompt(text: string): Pillar | null {
  const t = text.trim();
  for (const pillar of PILLARS) {
    if (PILLAR_INSIGHTS[pillar].prompt === t) return pillar;
  }
  return null;
}
