import { type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

const createAssignmentSchema = z.object({
  shopId: z.uuid(),
  repCompanyUserId: z.uuid(),
  isPrimary: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "back_office"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const db = getDb();
  const result = await db.query(
    `
    SELECT
      id,
      shop_id,
      rep_company_user_id,
      is_primary
    FROM shop_assignments
    WHERE company_id = $1
    ORDER BY assigned_at DESC
    `,
    [authResult.session.companyId]
  );

  return jsonOk({ assignments: result.rows });
}

export async function POST(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "back_office"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const parseResult = createAssignmentSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const { shopId, repCompanyUserId, isPrimary } = parseResult.data;
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const shopExists = await client.query(
      `
      SELECT id
      FROM shops
      WHERE id = $1 AND company_id = $2
      LIMIT 1
      `,
      [shopId, authResult.session.companyId]
    );
    if (!shopExists.rowCount) {
      await client.query("ROLLBACK");
      return jsonError(404, "Shop not found");
    }

    const repExists = await client.query(
      `
      SELECT id
      FROM company_users
      WHERE id = $1
        AND company_id = $2
        AND role = 'rep'
      LIMIT 1
      `,
      [repCompanyUserId, authResult.session.companyId]
    );
    if (!repExists.rowCount) {
      await client.query("ROLLBACK");
      return jsonError(400, "repCompanyUserId must reference a rep in this company");
    }

    if (isPrimary) {
      await client.query(
        `
        UPDATE shop_assignments
        SET is_primary = FALSE
        WHERE company_id = $1
          AND shop_id = $2
        `,
        [authResult.session.companyId, shopId]
      );
    }

    const upserted = await client.query(
      `
      INSERT INTO shop_assignments (company_id, shop_id, rep_company_user_id, is_primary)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (company_id, shop_id, rep_company_user_id)
      DO UPDATE SET is_primary = EXCLUDED.is_primary
      RETURNING *
      `,
      [authResult.session.companyId, shopId, repCompanyUserId, isPrimary]
    );

    await client.query("COMMIT");

    return jsonOk({ assignment: upserted.rows[0] }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not assign shop"
    );
  } finally {
    client.release();
  }
}

