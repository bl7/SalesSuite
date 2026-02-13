import { type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

const bodySchema = z.object({
  reassign_to_staff_id: z.uuid().optional(),
});

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
  const parseResult = bodySchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const reassignToId = parseResult.data.reassign_to_staff_id;
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const staff = await client.query<{ user_id: string; role: string }>(
      `SELECT user_id, role FROM company_users WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [companyUserId, authResult.session.companyId]
    );
    if (!staff.rowCount) {
      await client.query("ROLLBACK");
      return jsonError(404, "Staff member not found");
    }

    const assignmentCount = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM shop_assignments WHERE company_id = $1 AND rep_company_user_id = $2`,
      [authResult.session.companyId, companyUserId]
    );
    const count = parseInt(assignmentCount.rows[0]?.count ?? "0", 10);

    if (count > 0) {
      if (!reassignToId) {
        await client.query("ROLLBACK");
        return jsonError(
          400,
          "This rep has assigned shops. Provide reassign_to_staff_id to reassign them before deactivating."
        );
      }
      const otherRep = await client.query(
        `SELECT id FROM company_users WHERE id = $1 AND company_id = $2 AND role = 'rep' AND status = 'active' LIMIT 1`,
        [reassignToId, authResult.session.companyId]
      );
      if (!otherRep.rowCount) {
        await client.query("ROLLBACK");
        return jsonError(400, "reassign_to_staff_id must be an active rep in this company");
      }
      await client.query(
        `UPDATE shop_assignments SET rep_company_user_id = $1 WHERE company_id = $2 AND rep_company_user_id = $3`,
        [reassignToId, authResult.session.companyId, companyUserId]
      );
    }

    await client.query(
      `UPDATE company_users SET status = 'inactive' WHERE id = $1 AND company_id = $2`,
      [companyUserId, authResult.session.companyId]
    );

    await client.query("COMMIT");
    return jsonOk({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not deactivate"
    );
  } finally {
    client.release();
  }
}
