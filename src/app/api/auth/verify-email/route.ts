import { type NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_token", request.url));
  }

  const userId = await consumeToken(token, "email_verify");

  if (!userId) {
    return NextResponse.redirect(
      new URL("/auth/login?error=invalid_or_expired_token", request.url)
    );
  }

  const db = getDb();

  // Mark email as verified
  await db.query(
    `UPDATE users SET email_verified_at = NOW() WHERE id = $1 AND email_verified_at IS NULL`,
    [userId]
  );

  // When staff verifies, set their company_users status to active so they can log in
  await db.query(
    `UPDATE company_users SET status = 'active' WHERE user_id = $1`,
    [userId]
  );

  // Redirect to login with success message
  return NextResponse.redirect(new URL("/auth/login?verified=true", request.url));
}

