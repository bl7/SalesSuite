import { type PoolClient } from "pg";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { sendEmailVerification } from "@/lib/mail";
import { slugify } from "@/lib/slug";
import { createToken } from "@/lib/tokens";
import { getBaseUrl } from "@/lib/url";

const signupSchema = z.object({
  companyName: z.string().min(2).max(120),
  companySlug: z.string().min(2).max(80).optional(),
  fullName: z.string().min(2).max(120),
  email: z.email().max(255),
  password: z.string().min(8).max(128),
  phone: z.string().regex(/^\+977\d{10}$/, "Phone must be in +977XXXXXXXXXX format"),
  role: z.enum(["boss", "manager"]).default("manager"),
});

export async function POST(request: Request) {
  const parseResult = signupSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const { companyName, fullName, phone, password, role } = parseResult.data;
  const email = parseResult.data.email.toLowerCase().trim();
  const requestedSlug = parseResult.data.companySlug ?? slugify(companyName);
  const companySlug = requestedSlug || `company-${Date.now()}`;
  const passwordHash = await hashPassword(password);

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const companyId = await insertCompany(client, companyName, companySlug);
    const userId = await findOrCreateUser(
      client,
      email,
      fullName,
      passwordHash,
      password
    );

    const companyUserResult = await client.query<{ id: string }>(
      `
      INSERT INTO company_users (company_id, user_id, role, phone)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [companyId, userId, role, phone]
    );

    await client.query("COMMIT");

    // Send verification email (await so it also works reliably on Vercel)
    try {
      const baseUrl = getBaseUrl(request);
      const token = await createToken(userId, "email_verify", 24 * 60 * 60 * 1000);
      const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
      await sendEmailVerification(email, fullName, verifyUrl);
    } catch (err) {
      console.error("[mail] Failed to send verification email:", err);
    }

    return jsonOk(
      {
        company: {
          id: companyId,
          name: companyName,
          slug: companySlug,
        },
        user: {
          id: userId,
          email,
          fullName,
          role,
          companyUserId: companyUserResult.rows[0].id,
        },
      },
      201
    );
  } catch (error) {
    await client.query("ROLLBACK");

    if (isUniqueViolation(error)) {
      return jsonError(409, "Company slug or user membership already exists");
    }

    if (isExistingEmailPasswordMismatch(error)) {
      return jsonError(
        409,
        "Email is already registered. Please log in with the existing password."
      );
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not create company"
    );
  } finally {
    client.release();
  }
}

async function insertCompany(client: PoolClient, name: string, slug: string) {
  const result = await client.query<{ id: string }>(
    `
    INSERT INTO companies (name, slug)
    VALUES ($1, $2)
    RETURNING id
    `,
    [name, slug]
  );

  return result.rows[0].id;
}

async function findOrCreateUser(
  client: PoolClient,
  email: string,
  fullName: string,
  passwordHash: string,
  plainPassword: string
) {
  const existingUser = await client.query<{ id: string; password_hash: string }>(
    `
    SELECT id, password_hash
    FROM users
    WHERE email = $1
    LIMIT 1
    `,
    [email]
  );

  if (existingUser.rowCount) {
    const passwordMatch = await verifyPassword(
      plainPassword,
      existingUser.rows[0].password_hash
    );

    if (!passwordMatch) {
      throw new Error("EXISTING_EMAIL_PASSWORD_MISMATCH");
    }

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

function isExistingEmailPasswordMismatch(error: unknown) {
  return error instanceof Error && error.message === "EXISTING_EMAIL_PASSWORD_MISMATCH";
}

