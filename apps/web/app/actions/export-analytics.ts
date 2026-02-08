"use server";

import { auth } from "@/auth";
import {
  getExportData,
  getStartDate,
  type TimeRange,
  type ExportDataRow,
} from "@/lib/analytics-queries";

/**
 * Fetch analytics export data for CSV download
 *
 * @param range - Time range filter (7d, 30d, 90d, 1y)
 * @returns Array of export data rows
 */
export async function fetchExportData(range: TimeRange): Promise<ExportDataRow[]> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) throw new Error("Unauthorized");

  const startDate = getStartDate(range);
  const data = await getExportData(tenantId, startDate);
  return data;
}
