import { type NextRequest } from "next/server";
import { type PoolClient } from "pg";
import { randomBytes } from "crypto";
import { z } from "zod";

import { hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";
import { sendStaffCredentials, sendEmailVerification } from "@/lib/mail";
import { createToken } from "@/lib/tokens";
import { getBaseUrl } from "@/lib/url";

const createStaffSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(255),
  phone: z.string().min(10).max(20),
  role: z.enum(["manager", "rep", "back_office"]).default("rep"),
  managerCompanyUserId: z.uuid().optional(),
});

/** Normalize phone to +977XXXXXXXXXX for storage; allow digits and optional +977 prefix. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && !phone.startsWith("+")) return `+977${digits}`;
  if (digits.length === 13 && digits.startsWith("977")) return `+${digits}`;
  if (digits.length >= 10) return `+977${digits.slice(-10)}`;
  return `+977${digits.padStart(10, "0")}`;
}

function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  let s = "";
  for (let i = 0; i < 16; i++) s += chars[bytes[i]! % chars.length];
  return s;
}

type StaffRow = {
  company_user_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: "boss" | "manager" | "rep" | "back_office";
  status: "invited" | "active" | "inactive";
  phone: string | null;
  manager_company_user_id: string | null;
  created_at: string;
  updated_at: string;
  email_verified_at: string | null;
  last_login_at: string | null;
  assigned_shops_count: number;
};

export async function GET(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), [
    "boss",
    "manager",
    "back_office",
  ]);
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const statusParam = searchParams.get("status")?.toLowerCase();
  const roleParam = searchParams.get("role")?.trim().toLowerCase();

  const statusFilter =
    statusParam === "invited" || statusParam === "active" || statusParam === "inactive"
      ? statusParam
      : null;
  const roleFilter =
    roleParam === "rep" ||
    roleParam === "manager" ||
    roleParam === "back_office" ||
    roleParam === "boss"
      ? roleParam
      : null;

  const db = getDb();

  const result = await db.query<StaffRow>(
    `
    SELECT
      cu.id AS company_user_id,
      u.id AS user_id,
      u.full_name,
      u.email,
      cu.role,
      cu.status,
      cu.phone,
      cu.manager_company_user_id,
      cu.created_at,
      cu.updated_at,
      u.email_verified_at::text,
      u.last_login_at::text,
      (
        SELECT COUNT(*)::int
        FROM shop_assignments sa
        WHERE sa.company_id = cu.company_id
          AND sa.rep_company_user_id = cu.id
      ) AS assigned_shops_count
    FROM company_users cu
    JOIN users u ON u.id = cu.user_id
    WHERE cu.company_id = $1
      AND ($2::text = '' OR u.full_name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%' OR cu.phone ILIKE '%' || $2 || '%')
      AND ($3::text IS NULL OR cu.status = $3)
      AND ($4::text IS NULL OR cu.role = $4)
    ORDER BY cu.created_at DESC
    `,
    [authResult.session.companyId, q, statusFilter, roleFilter]
  );

  const countsResult = await db.query<{ status: string; count: string }>(
    `
    SELECT cu.status, COUNT(*)::text AS count
    FROM company_users cu
    WHERE cu.company_id = $1
    GROUP BY cu.status
    `,
    [authResult.session.companyId]
  );

  const counts = { active: 0, invited: 0, inactive: 0 };
  for (const row of countsResult.rows) {
    if (row.status in counts) counts[row.status as keyof typeof counts] = parseInt(row.count, 10);
  }

  return jsonOk({ staff: result.rows, counts });
}

export async function POST(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), [
    "boss",
    "manager",
  ]);
  if (!authResult.ok) return authResult.response;

  const parseResult = createStaffSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(
      400,
      parseResult.error.issues[0]?.message ?? "Invalid body"
    );
  }

  const input = parseResult.data;
  const email = input.email.toLowerCase().trim();
  const phone = normalizePhone(input.phone);
  if (!/^\+977\d{10}$/.test(phone)) {
    return jsonError(400, "Phone must be 10 digits or +977 followed by 10 digits");
  }

  const db = getDb();

  const limitRow = await db.query<{ staff_limit: number }>(
    `SELECT COALESCE(staff_limit, 5)::int AS staff_limit FROM companies WHERE id = $1`,
    [authResult.session.companyId]
  );
  const staffLimit = limitRow.rows[0]?.staff_limit ?? 5;
  const totalAllowed = staffLimit + 1;

  const countRow = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM company_users WHERE company_id = $1`,
    [authResult.session.companyId]
  );
  const currentCount = parseInt(countRow.rows[0]?.count ?? "0", 10);
  if (currentCount >= totalAllowed) {
    return jsonError(
      403,
      `Staff limit reached. Your plan allows 1 manager + ${staffLimit} staff (${totalAllowed} users total). Contact support to increase your limit.`
    );
  }

  const client = await db.connect();
  const password = generateRandomPassword();
  const passwordHash = await hashPassword(password);

  try {
    await client.query("BEGIN");

    if (input.managerCompanyUserId) {
      await ensureManagerExists(
        client,
        authResult.session.companyId,
        input.managerCompanyUserId
      );
    }

    const userId = await findOrCreateUser(
      client,
      email,
      input.fullName,
      passwordHash
    );

    const companyUser = await client.query<{
      id: string;
      role: "manager" | "rep" | "back_office";
      status: string;
    }>(
      `
      INSERT INTO company_users (
        company_id,
        user_id,
        role,
        status,
        phone,
        manager_company_user_id
      )
      VALUES ($1, $2, $3, 'invited', $4, $5)
      RETURNING id, role, status
      `,
      [
        authResult.session.companyId,
        userId,
        input.role,
        phone,
        input.managerCompanyUserId ?? null,
      ]
    );

    await client.query("COMMIT");

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
        input.fullName,
        companyName,
        password,
        loginUrl
      );
    } catch (err) {
      console.error("[mail] Failed to send staff credentials:", err);
    }

    try {
      const token = await createToken(
        userId,
        "email_verify",
        24 * 60 * 60 * 1000
      );
      const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
      await sendEmailVerification(email, input.fullName, verifyUrl);
    } catch (err) {
      console.error("[mail] Failed to send verification email:", err);
    }

    return jsonOk(
      {
        staff: {
          company_user_id: companyUser.rows[0].id,
          user_id: userId,
          email,
          full_name: input.fullName,
          role: companyUser.rows[0].role,
          status: "invited",
        },
      },
      201
    );
  } catch (error) {
    await client.query("ROLLBACK");

    if (isUniqueViolation(error)) {
      return jsonError(409, "A staff member with this email already exists");
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not create staff"
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
    `
    SELECT id
    FROM company_users
    WHERE company_id = $1
      AND id = $2
      AND role IN ('boss', 'manager')
    LIMIT 1
    `,
    [companyId, managerCompanyUserId]
  );

  if (!result.rowCount) {
    throw new Error("managerCompanyUserId does not exist in this company");
  }
}

async function findOrCreateUser(
  client: PoolClient,
  email: string,
  fullName: string,
  passwordHash: string
) {
  const existingUser = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );

  if (existingUser.rowCount) {
    await client.query(
      `UPDATE users SET full_name = $1, password_hash = $2 WHERE id = $3`,
      [fullName, passwordHash, existingUser.rows[0].id]
    );
    return existingUser.rows[0].id;
  }

  const createdUser = await client.query<{ id: string }>(
    `
    INSERT INTO users (email, full_name, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id
    `,
    [email, fullName, passwordHash]
  );

  return createdUser.rows[0].id;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}
