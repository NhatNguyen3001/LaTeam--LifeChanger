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
    <div className="bg-card rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{w.label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">
          {w.value}
          {w.unit ? <span className="text-muted-foreground ml-0.5 text-base">{w.unit}</span> : null}
        </span>
        {w.delta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs",
              up ? "text-chart-2" : "text-destructive",
            )}
          >
            {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(w.delta)}
          </span>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="mb-3 text-sm font-medium">{title}</div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
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
    <div className="bg-muted/30 space-y-4 rounded-2xl border p-4">
      {spec.title && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">{spec.title}</h3>
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
                        "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:border-ring/50",
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((w, i) => (
            <StatTile key={w.id ?? i} w={w} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rest.map((w, i) => {
          const key = w.id ?? `${w.kind}-${i}`;
          if (w.kind === "table") {
            return (
              <div key={key} className="bg-card rounded-xl border p-4 md:col-span-2">
                <div className="mb-3 text-sm font-medium">{w.title}</div>
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
            return (
              <div key={key} className="md:col-span-2">
                <ChartCard title={w.title}>
                  <LineChart data={w.data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey={w.x} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {w.series.length > 1 && <Legend />}
                    {w.series.map((s, si) => (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label ?? s.key}
                        stroke={PALETTE[si % PALETTE.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ChartCard>
              </div>
            );
          }
          if (w.kind === "bar") {
            return (
              <ChartCard key={key} title={w.title}>
                <BarChart data={w.data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey={w.x} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
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
