import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { ReportView } from "@/components/report/report-view";
import type { ReportSpec } from "@/lib/report/types";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!row) notFound();
  return <ReportView spec={row.spec as ReportSpec} />;
}
