"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DashboardSpec,
  DashboardFilter,
  DataRow,
  Widget,
} from "@/lib/dashboard/types";
import { useActiveDashboard } from "@/lib/dashboard/active-context";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type FilterState = Record<string, string[]>;

function collectSeriesValues(data: DataRow[], series: { key: string }[]): number[] {
  const vals: number[] = [];
  for (const row of data) {
    for (const s of series) {
      const v = row[s.key];
      if (typeof v === "number" && !Number.isNaN(v)) vals.push(v);
    }
  }
  return vals;
}

/** Zoom Y-axis for Likert /5 data so term-to-term changes are visible. */
function likertYDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 5];
  const min = Math.min(...values);
  const max = Math.max(...values);
  let lo = Math.max(0, Math.floor((min - 0.15) * 10) / 10);
  let hi = Math.min(5, Math.ceil((max + 0.15) * 10) / 10);
  if (hi - lo < 0.6) {
    const mid = (hi + lo) / 2;
    lo = Math.max(0, Math.round((mid - 0.35) * 10) / 10);
    hi = Math.min(5, Math.round((mid + 0.35) * 10) / 10);
  }
  return [lo, hi];
}

function isLikertChart(
  widget: Extract<Widget, { kind: "line" | "bar" }>,
  stats: Extract<Widget, { kind: "stat" }>[],
): boolean {
  const values = collectSeriesValues(widget.data, widget.series);
  if (values.length === 0) return false;

  const title = widget.title.toLowerCase();
  const seriesText = widget.series
    .map((s) => `${s.key} ${s.label ?? ""}`.toLowerCase())
    .join(" ");

  if (stats.some((s) => s.unit === "/5" || String(s.unit).includes("/5"))) return true;
  if (/likert|rating|avg_likert/.test(title + seriesText)) return true;
  return values.every((v) => v >= 0 && v <= 5.5) && values.some((v) => v > 0 && v <= 5);
}

function yDomainForChart(
  widget: Extract<Widget, { kind: "line" | "bar" }>,
  stats: Extract<Widget, { kind: "stat" }>[],
): [number, number] | undefined {
  if (!isLikertChart(widget, stats)) return undefined;
  return likertYDomain(collectSeriesValues(widget.data, widget.series));
}

function filterRows(rows: DataRow[], filters: DashboardFilter[], state: FilterState) {
  return rows.filter((r) =>
    filters.every((f) => {
      const fid = f.id ?? f.field;
      const selected = state[fid];
      if (!selected || selected.length === 0) return true;
      if (!(f.field in r)) return true; // filter doesn't apply to this widget
      return selected.includes(String(r[f.field]));
    }),
  );
}

function StatTile({ w }: { w: Extract<Widget, { kind: "stat" }> }) {
  const up = (w.delta ?? 0) >= 0;
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-foreground bg-white">
      <p className="lc-heading border-b border-foreground/10 px-4 py-2.5 text-[10px] leading-snug tracking-[0.08em]">
        {w.label}
      </p>
      <div className="bg-primary px-4 py-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-3xl font-bold tabular-nums tracking-tight">{w.value}</span>
          {w.unit ? (
            <span className="text-base font-semibold opacity-80">{w.unit}</span>
          ) : null}
        </div>
        {w.delta != null && (
          <p
            className={cn(
              "mt-2 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold",
              up ? "text-foreground" : "text-destructive",
            )}
          >
            {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {up ? "+" : "−"}
            {Math.abs(w.delta)}
          </p>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  // Render the chart only after mount. Recharts generates non-deterministic
  // internal ids (clipPaths, gradients), so server-rendering it inside a saved
  // chat thread causes a hydration mismatch. Keeping it client-only also means
  // the container has real layout dimensions by the time it renders.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="rounded-2xl border border-foreground/20 bg-white p-4">
      <div className="lc-heading mb-3 text-xs tracking-[0.1em]">{title}</div>
      <div className="h-56 w-full lg:h-64 xl:h-72">
        {mounted && (
          <ResponsiveContainer
            width="100%"
            height="100%"
            // Start from a positive size so Recharts does not warn on the first
            // render (its default initialDimension is -1) before the
            // ResizeObserver reports the real size on the next frame.
            initialDimension={{ width: 500, height: 224 }}
          >
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function Dashboard({
  spec,
  dashboardId,
}: {
  spec: DashboardSpec;
  dashboardId?: string;
}) {
  const filters = spec.filters ?? [];
  const [state, setState] = useState<FilterState>({});
  const active = useActiveDashboard();

  // Becomes the "active dashboard" when first rendered (most recent block).
  useEffect(() => {
    if (dashboardId) active?.activate(dashboardId, spec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId]);

  function toggle(filter: DashboardFilter, value: string) {
    const fid = filter.id ?? filter.field;
    const cur = state[fid] ?? [];
    const has = cur.includes(value);
    const nextSel = filter.multi
      ? has
        ? cur.filter((v) => v !== value)
        : [...cur, value]
      : has
        ? []
        : [value];
    const next = { ...state, [fid]: nextSel };
    setState(next);
    // Report the on-screen filter state so follow-up questions reason about THIS view.
    if (dashboardId) active?.updateFilters(dashboardId, spec, next);
  }

  // Drilldown: click a bar/x category → narrow any filter that targets that field.
  function drill(field: string, value: string) {
    const f = filters.find((x) => x.field === field);
    if (f) toggle(f, value);
  }

  const widgets = useMemo(
    () =>
      spec.widgets.map((w) => {
        if (w.kind === "line" || w.kind === "bar")
          return { ...w, data: filterRows(w.data, filters, state) };
        if (w.kind === "pie")
          return { ...w, data: filterRows(w.data, filters, state) };
        if (w.kind === "table")
          return { ...w, rows: filterRows(w.rows, filters, state) };
        return w;
      }),
    [spec.widgets, filters, state],
  );

  const stats = widgets.filter((w) => w.kind === "stat");
  const rest = widgets.filter((w) => w.kind !== "stat");

  return (
    <div className="lc-brown-card space-y-4 rounded-3xl p-4">
      {spec.title && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="lc-heading text-sm tracking-[0.08em]">{spec.title}</h3>
        </div>
      )}

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {filters.map((f) => {
            const fid = f.id ?? f.field;
            return (
              <div key={fid} className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground text-xs">{f.label}:</span>
                {f.options.map((opt) => {
                  const active = (state[fid] ?? []).includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggle(f, opt)}
                      className={cn(
                        "lc-pill py-1 text-[10px] tracking-[0.08em]",
                        active
                          ? "bg-primary shadow-[2px_2px_0_0_var(--lc-white)]"
                          : "hover:bg-primary/40",
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {stats.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((w, i) => (
            <StatTile key={w.id ?? i} w={w} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {rest.map((w, i) => {
          const key = w.id ?? `${w.kind}-${i}`;
          if (w.kind === "table") {
            return (
              <div key={key} className="rounded-2xl border border-foreground/20 bg-white p-4 lg:col-span-2 xl:col-span-3">
                <div className="lc-heading mb-3 text-xs tracking-[0.1em]">{w.title}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground text-left">
                      <tr>
                        {w.columns.map((c) => (
                          <th key={c.key} className="py-1.5 pr-4 font-medium">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {w.rows.map((r, ri) => (
                        <tr key={ri} className="border-t">
                          {w.columns.map((c) => (
                            <td key={c.key} className="py-1.5 pr-4">
                              {r[c.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          if (w.kind === "line") {
            const yDomain = yDomainForChart(w, stats);
            return (
              <div key={key} className="lg:col-span-2 xl:col-span-3">
                <ChartCard title={w.title}>
                  <LineChart data={w.data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey={w.x} tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={yDomain ?? ["auto", "auto"]}
                      allowDataOverflow={false}
                      tickCount={yDomain ? 6 : undefined}
                    />
                    <Tooltip />
                    {w.series.length > 1 && <Legend />}
                    {w.series.map((s, si) => (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label ?? s.key}
                        stroke={PALETTE[si % PALETTE.length]}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: PALETTE[si % PALETTE.length] }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ChartCard>
              </div>
            );
          }
          if (w.kind === "bar") {
            const yDomain = yDomainForChart(w, stats);
            return (
              <ChartCard key={key} title={w.title}>
                <BarChart data={w.data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey={w.x} tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={yDomain ?? ["auto", "auto"]}
                    allowDataOverflow={false}
                    tickCount={yDomain ? 6 : undefined}
                  />
                  <Tooltip />
                  {w.series.length > 1 && <Legend />}
                  {w.series.map((s, si) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label ?? s.key}
                      fill={PALETTE[si % PALETTE.length]}
                      radius={[4, 4, 0, 0]}
                      onClick={(d: { payload?: DataRow }) =>
                        d?.payload && drill(w.x, String(d.payload[w.x]))
                      }
                      cursor="pointer"
                    />
                  ))}
                </BarChart>
              </ChartCard>
            );
          }
          // pie
          return (
            <ChartCard key={key} title={w.title}>
              <PieChart>
                <Tooltip />
                <Pie
                  data={w.data}
                  dataKey={w.valueKey}
                  nameKey={w.nameKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(e: { name?: string }) => e.name ?? ""}
                >
                  {w.data.map((_, di) => (
                    <Cell key={di} fill={PALETTE[di % PALETTE.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartCard>
          );
        })}
      </div>
    </div>
  );
}
