/**
 * Create a platform boss. Run after migrating.
 * Usage: node scripts/create-first-boss.js
 * Env: BOSS_EMAIL, BOSS_PASSWORD, BOSS_FULL_NAME (optional)
 * Default: boss@salessuite.local / changeme123
 */

const { readFileSync, existsSync } = require("fs");
const { join } = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

function loadEnv() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

const email = (process.env.BOSS_EMAIL || "boss@salessuite.local").toLowerCase().trim();
const password = process.env.BOSS_PASSWORD || "changeme123";
const fullName = process.env.BOSS_FULL_NAME || "Boss";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set. Set it in .env or the environment.");
    process.exit(1);
  }
  let conn = connectionString;
  if (conn.includes("sslmode=require")) conn = conn.replace("sslmode=require", "sslmode=no-verify");
  const ssl = conn.includes("aivencloud.com") ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString: conn, ssl });
  const client = await pool.connect();
  try {
    const existing = await client.query("SELECT id FROM bosses WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      console.log("Boss already exists for", email);
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      "INSERT INTO bosses (email, password_hash, full_name) VALUES ($1, $2, $3)",
      [email, passwordHash, fullName]
    );
    console.log("Created first boss:", email);
    console.log("Sign in at /boss/login");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
