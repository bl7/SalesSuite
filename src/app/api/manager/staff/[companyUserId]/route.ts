import { type NextRequest } from "next/server";
import { type PoolClient } from "pg";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+977${digits}`;
  if (digits.length === 13 && digits.startsWith("977")) return `+${digits}`;
  if (digits.length >= 10) return `+977${digits.slice(-10)}`;
  return `+977${digits.padStart(10, "0")}`;
}

const updateStaffSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().max(255).optional(),
  role: z.enum(["manager", "rep", "back_office"]).optional(),
  status: z.enum(["invited", "active", "inactive"]).optional(),
  phone: z.string().min(10).max(20).optional(),
  managerCompanyUserId: z.uuid().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ companyUserId: string }> }
) {
  const authResult = ensureRole(await getRequestSession(request), [
    "boss",
    "manager",
  ]);
  if (!authResult.ok) return authResult.response;

  const parseResult = updateStaffSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const { companyUserId } = await context.params;
  const input = parseResult.data;
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{ user_id: string }>(
      `SELECT user_id FROM company_users WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [companyUserId, authResult.session.companyId]
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return jsonError(404, "Staff member not found");
    }

    const userId = existing.rows[0].user_id;

    if (input.managerCompanyUserId) {
      await ensureManagerExists(
        client,
        authResult.session.companyId,
        input.managerCompanyUserId
      );
    }

    if (input.fullName) {
      await client.query(
        `UPDATE users SET full_name = $1 WHERE id = $2`,
        [input.fullName, userId]
      );
    }

    if (input.email !== undefined) {
      const email = input.email.toLowerCase().trim();
      await client.query(
        `UPDATE users SET email = $1, email_verified_at = NULL WHERE id = $2`,
        [email, userId]
      );
    }

    const updates: string[] = [];
    const values: Array<string | null> = [];
    let position = 1;

    if (input.role !== undefined) {
      updates.push(`role = $${position++}`);
      values.push(input.role);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${position++}`);
      values.push(input.status);
    }
    if (input.phone !== undefined) {
      const phone = normalizePhone(input.phone);
      if (!/^\+977\d{10}$/.test(phone)) {
        await client.query("ROLLBACK");
        return jsonError(400, "Phone must be 10 digits or +977 followed by 10 digits");
      }
      updates.push(`phone = $${position++}`);
      values.push(phone);
    }
    if (input.managerCompanyUserId !== undefined) {
      updates.push(`manager_company_user_id = $${position++}`);
      values.push(input.managerCompanyUserId);
    }

    if (updates.length) {
      values.push(companyUserId, authResult.session.companyId);
      await client.query(
        `UPDATE company_users SET ${updates.join(", ")} WHERE id = $${position++} AND company_id = $${position}`,
        values
      );
    }

    const updated = await client.query(
      `
      SELECT cu.id AS company_user_id, cu.role, cu.status, cu.phone, cu.manager_company_user_id,
             u.id AS user_id, u.full_name, u.email
      FROM company_users cu
      JOIN users u ON u.id = cu.user_id
      WHERE cu.id = $1 AND cu.company_id = $2
      LIMIT 1
      `,
      [companyUserId, authResult.session.companyId]
    );

    await client.query("COMMIT");
    return jsonOk({ staff: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not update staff member"
    );
  } finally {
    client.release();
  }
}

async function ensureManagerExists(
  client: PoolClient,
  companyId: string,
  managerCompanyUserId: string
) {
  const result = await client.query(
    `SELECT id FROM company_users WHERE company_id = $1 AND id = $2 AND role IN ('boss', 'manager') LIMIT 1`,
    [companyId, managerCompanyUserId]
  );
  if (!result.rowCount) throw new Error("Manager does not exist in this company");
}
