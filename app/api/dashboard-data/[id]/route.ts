import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dashboards } from "@/lib/db/schema";

// Re-fetch a dashboard's full underlying data by id (used for large result sets
// where the inline spec only carries a compact / top-N slice).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ dashboardId: row.id, dataRef: row.dataRef ?? row.spec });
}
