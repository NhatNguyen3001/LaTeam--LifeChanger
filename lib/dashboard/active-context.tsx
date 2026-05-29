"use client";

import { createContext, useContext } from "react";
import type { DashboardSpec } from "@/lib/dashboard/types";

export type ActiveDashboard = {
  id: string;
  title: string;
  filters: Record<string, string[]>;
  spec: DashboardSpec;
};

type Ctx = {
  /** Mark a dashboard as the one the user is currently looking at / interacting with. */
  activate: (id: string, spec: DashboardSpec) => void;
  /** Report the dashboard's current client-side filter selection. */
  updateFilters: (id: string, spec: DashboardSpec, filters: Record<string, string[]>) => void;
};

export const ActiveDashboardContext = createContext<Ctx | null>(null);
export const useActiveDashboard = () => useContext(ActiveDashboardContext);
