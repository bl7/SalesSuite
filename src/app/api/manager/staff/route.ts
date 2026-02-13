import { type NextRequest } from "next/server";
import { type PoolClient } from "pg";
import { z } from "zod";

import { hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";
import { sendStaffCredentials, sendEmailVerification } from "@/lib/mail";
import { createToken } from "@/lib/tokens";
import { getBaseUrl } from "@/lib/url";

const createStaffSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["manager", "rep", "back_office"]).default("rep"),
  status: z.enum(["active", "inactive"]).default("active"),
  phone: z.string().regex(/^\+977\d{10}$/, "Phone must be in +977XXXXXXXXXX format"),
  managerCompanyUserId: z.uuid().optional(),
});

type StaffRow = {
  company_user_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: "boss" | "manager" | "rep" | "back_office";
  status: "active" | "inactive";
  phone: string | null;
  manager_company_user_id: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const result = await getDb().query<StaffRow>(
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
      cu.created_at
    FROM company_users cu
    JOIN users u ON u.id = cu.user_id
    WHERE cu.company_id = $1
      AND ($2::text = '' OR u.full_name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
    ORDER BY cu.created_at DESC
    `,
    [authResult.session.companyId, q]
  );

  return jsonOk({ staff: result.rows });
}

export async function POST(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const parseResult = createStaffSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const input = parseResult.data;
  const email = input.email.toLowerCase().trim();
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (input.managerCompanyUserId) {
      await ensureManagerExists(client, authResult.session.companyId, input.managerCompanyUserId);
    }

    const userId = await findOrCreateUser(
      client,
      email,
      input.fullName,
      await hashPassword(input.password)
    );

    const companyUser = await client.query<{
      id: string;
      role: "manager" | "rep" | "back_office";
      status: "active" | "inactive";
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
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, role, status
      `,
      [
        authResult.session.companyId,
        userId,
        input.role,
        input.status,
        input.phone,
        input.managerCompanyUserId ?? null,
      ]
    );

    await client.query("COMMIT");

    const baseUrl = getBaseUrl(request);
    const loginUrl = `${baseUrl}/auth/login`;

    // Look up company name for the email
    const companyRow = await db.query<{ name: string }>(
      `SELECT name FROM companies WHERE id = $1`,
      [authResult.session.companyId]
    );
    const companyName = companyRow.rows[0]?.name ?? "your company";

    // Send emails (await so they also work reliably on Vercel)
    try {
      await sendStaffCredentials(email, input.fullName, companyName, input.password, loginUrl);
    } catch (err) {
      console.error("[mail] Failed to send staff credentials:", err);
    }

    try {
      const token = await createToken(userId, "email_verify", 24 * 60 * 60 * 1000);
      const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
      await sendEmailVerification(email, input.fullName, verifyUrl);
    } catch (err) {
      console.error("[mail] Failed to send verification email:", err);
    }

    return jsonOk(
      {
        staff: {
          companyUserId: companyUser.rows[0].id,
          userId,
          email,
          fullName: input.fullName,
          role: companyUser.rows[0].role,
          status: companyUser.rows[0].status,
        },
      },
      201
    );
  } catch (error) {
    await client.query("ROLLBACK");

    if (isUniqueViolation(error)) {
      return jsonError(409, "Staff user already exists in this company");
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
    `
    SELECT id
    FROM users
    WHERE email = $1
    LIMIT 1
    `,
    [email]
  );

  if (existingUser.rowCount) {
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
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

