import { type NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ companyUserId: string }> }
) {
  const authResult = ensureRole(await getRequestSession(request), [
    "boss",
    "manager",
  ]);
  if (!authResult.ok) return authResult.response;

  const { companyUserId } = await context.params;
  const db = getDb();

  const result = await db.query(
    `UPDATE company_users SET status = 'active' WHERE id = $1 AND company_id = $2 RETURNING id`,
    [companyUserId, authResult.session.companyId]
  );

  if (!result.rowCount) return jsonError(404, "Staff member not found");

  return jsonOk({ ok: true });
}
