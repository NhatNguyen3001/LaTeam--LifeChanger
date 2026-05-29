import { z } from "zod";

const cell = z.union([z.string(), z.number()]);
const row = z.record(z.string(), cell);
const seriesDef = z.object({ key: z.string(), label: z.string().optional() });

export const statWidget = z.object({
  kind: z.literal("stat"),
  id: z.string().optional(),
  label: z.string(),
  value: cell,
  unit: z.string().optional(),
  delta: z.number().optional().describe("Change vs previous period; renders an up/down badge."),
});

export const lineWidget = z.object({
  kind: z.literal("line"),
  id: z.string().optional(),
  title: z.string(),
  x: z.string().describe("Key in each data row used for the x-axis."),
  series: z.array(seriesDef).describe("One entry per line; key must exist in data rows."),
  data: z.array(row),
});

export const barWidget = z.object({
  kind: z.literal("bar"),
  id: z.string().optional(),
  title: z.string(),
  x: z.string(),
  series: z.array(seriesDef),
  data: z.array(row),
});

export const pieWidget = z.object({
  kind: z.literal("pie"),
  id: z.string().optional(),
  title: z.string(),
  nameKey: z.string(),
  valueKey: z.string(),
  data: z.array(row),
});

export const tableWidget = z.object({
  kind: z.literal("table"),
  id: z.string().optional(),
  title: z.string(),
  columns: z.array(z.object({ key: z.string(), label: z.string() })),
  rows: z.array(row),
});

export const widget = z.discriminatedUnion("kind", [
  statWidget,
  lineWidget,
  barWidget,
  pieWidget,
  tableWidget,
]);

export const dashboardFilter = z.object({
  id: z.string().optional(),
  label: z.string(),
  field: z.string().describe("Key in widget data rows this filter narrows by."),
  options: z.array(z.string()),
  multi: z.boolean().optional(),
});

export const dashboardSpec = z.object({
  title: z.string(),
  filters: z.array(dashboardFilter).optional(),
  widgets: z.array(widget),
});

export type Cell = z.infer<typeof cell>;
export type DataRow = z.infer<typeof row>;
export type Widget = z.infer<typeof widget>;
export type DashboardFilter = z.infer<typeof dashboardFilter>;
export type DashboardSpec = z.infer<typeof dashboardSpec>;
