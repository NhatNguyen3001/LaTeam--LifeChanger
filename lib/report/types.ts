import { z } from "zod";
import type { Widget } from "@/lib/dashboard/types";

export const AUDIENCES = ["funder", "school", "board"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const reportNarrative = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  sections: z.array(
    z.object({
      heading: z.string(),
      body: z.string().describe("1-3 short paragraphs of narrative (use blank lines between paragraphs)."),
      widgetIds: z
        .array(z.string())
        .optional()
        .describe("ids of charts to display under this section"),
    }),
  ),
});
export type ReportNarrative = z.infer<typeof reportNarrative>;

export type ReportSpec = ReportNarrative & {
  audience: Audience;
  generatedAt: string;
  widgets: Widget[];
  quotes: { text: string; topic: string }[];
};

export const AUDIENCE_GUIDANCE: Record<Audience, string> = {
  funder:
    "Audience: a FUNDER. Lead with evidence, reach and impact. Emphasise scale (responses, schools, " +
    "workshops), measurable outcomes, equity reach (lower-ICSEA schools), and value for money. Confident, evidence-led tone.",
  school:
    "Audience: a partner SCHOOL. Emphasise student wellbeing outcomes, engagement, and pillar-specific " +
    "growth. Warm and concrete; foreground student voices/stories.",
  board:
    "Audience: the BOARD. Strategic and concise. Cover overall trend, what's working, risks (declining/under-" +
    "performing areas, facilitator quality), equity, and 2-3 priorities. Decision-useful tone.",
};
