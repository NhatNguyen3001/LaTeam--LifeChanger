import { notFound } from "next/navigation";
import { AUDIENCES, type Audience } from "@/lib/report/types";
import { buildPreviewReport } from "@/lib/report/build-preview";
import { ReportView } from "@/components/report/report-view";

export const dynamic = "force-dynamic";

export default async function ReportPreviewPage({
  params,
}: {
  params: Promise<{ audience: string }>;
}) {
  const { audience } = await params;
  if (!AUDIENCES.includes(audience as Audience)) notFound();

  let spec;
  try {
    spec = await buildPreviewReport(audience as Audience);
  } catch {
    notFound();
  }

  return <ReportView spec={spec} />;
}
