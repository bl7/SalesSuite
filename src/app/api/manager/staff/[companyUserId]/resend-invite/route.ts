import { type NextRequest } from "next/server";
import { randomBytes } from "crypto";

import { hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";
import { sendStaffCredentials, sendEmailVerification } from "@/lib/mail";
import { createToken } from "@/lib/tokens";
import { getBaseUrl } from "@/lib/url";

function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  let s = "";
  for (let i = 0; i < 16; i++) s += chars[bytes[i]! % chars.length];
  return s;
}

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

  const row = await db.query<{
    user_id: string;
    full_name: string;
    email: string;
    status: string;
  }>(
    `
    SELECT u.id AS user_id, u.full_name, u.email, cu.status
    FROM company_users cu
    JOIN users u ON u.id = cu.user_id
    WHERE cu.id = $1 AND cu.company_id = $2
    LIMIT 1
    `,
    [companyUserId, authResult.session.companyId]
  );

  if (!row.rowCount) return jsonError(404, "Staff member not found");

  const { user_id, full_name, email } = row.rows[0];
  const password = generateRandomPassword();
  const passwordHash = await hashPassword(password);

  await db.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [passwordHash, user_id]
  );

  const baseUrl = getBaseUrl(request);
  const loginUrl = `${baseUrl}/auth/login`;

  const companyRow = await db.query<{ name: string }>(
    `SELECT name FROM companies WHERE id = $1`,
    [authResult.session.companyId]
  );
  const companyName = companyRow.rows[0]?.name ?? "your company";

  try {
    await sendStaffCredentials(
      email,
      full_name,
      companyName,
      password,
      loginUrl
    );
  } catch (err) {
    console.error("[mail] Failed to send staff credentials:", err);
  }

  try {
    const token = await createToken(
      user_id,
      "email_verify",
      24 * 60 * 60 * 1000
    );
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
    await sendEmailVerification(email, full_name, verifyUrl);
  } catch (err) {
    console.error("[mail] Failed to send verification email:", err);
  }

  return jsonOk({ ok: true, message: "Invite email sent" });
}
