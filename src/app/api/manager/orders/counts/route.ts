import { type NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

export async function GET(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "rep", "back_office"]);
  if (!authResult.ok) return authResult.response;

  const isRep = authResult.session.role === "rep";
  const conditions = ["company_id = $1"];
  const values: (string | number)[] = [authResult.session.companyId];
  if (isRep) {
    conditions.push("placed_by_company_user_id = $2");
    values.push(authResult.session.companyUserId);
  }

  const result = await getDb().query<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*)::text AS cnt FROM orders WHERE ${conditions.join(" AND ")} GROUP BY status`,
    values
  );

  const counts = {
    received: 0,
    processing: 0,
    shipped: 0,
    closed: 0,
    cancelled: 0,
  };
  for (const row of result.rows) {
    if (row.status in counts) {
      (counts as Record<string, number>)[row.status] = parseInt(row.cnt, 10);
    }
  }

  return jsonOk({ counts });
}
