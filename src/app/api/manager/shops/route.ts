import { type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

const createShopSchema = z.object({
  externalShopCode: z.string().max(80).optional(),
  name: z.string().min(2).max(150),
  contactName: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  geofenceRadiusM: z.number().int().positive().max(500).default(60),
  locationSource: z.enum(["manual_pin", "gps_capture", "imported"]).default("manual_pin"),
  locationVerified: z.boolean().default(false),
  locationAccuracyM: z.number().nonnegative().max(99999).optional(),
  arrivalPromptEnabled: z.boolean().default(true),
  minDwellSeconds: z.number().int().min(0).default(120),
  cooldownMinutes: z.number().int().min(0).default(30),
  timezone: z.string().max(64).optional(),
});

export async function GET(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "back_office"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const result = await getDb().query(
    `
    SELECT
      s.id,
      s.external_shop_code,
      s.name,
      s.contact_name,
      s.phone,
      s.address,
      s.latitude,
      s.longitude,
      s.geofence_radius_m,
      s.location_source,
      s.location_verified,
      s.location_accuracy_m,
      s.arrival_prompt_enabled,
      s.min_dwell_seconds,
      s.cooldown_minutes,
      s.timezone,
      s.is_active,
      s.created_at,
      s.updated_at,
      COUNT(sa.id)::int AS assignment_count
    FROM shops s
    LEFT JOIN shop_assignments sa
      ON sa.shop_id = s.id
      AND sa.company_id = s.company_id
    WHERE s.company_id = $1
      AND ($2::text = '' OR s.name ILIKE '%' || $2 || '%' OR COALESCE(s.external_shop_code, '') ILIKE '%' || $2 || '%')
    GROUP BY s.id
    ORDER BY s.created_at DESC
    `,
    [authResult.session.companyId, q]
  );

  return jsonOk({ shops: result.rows });
}

export async function POST(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const parseResult = createShopSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const input = parseResult.data;

  try {
    const result = await getDb().query(
      `
      INSERT INTO shops (
        company_id,
        external_shop_code,
        name,
        contact_name,
        phone,
        address,
        latitude,
        longitude,
        geofence_radius_m,
        location_source,
        location_verified,
        location_accuracy_m,
        arrival_prompt_enabled,
        min_dwell_seconds,
        cooldown_minutes,
        timezone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
      `,
      [
        authResult.session.companyId,
        input.externalShopCode ?? null,
        input.name,
        input.contactName ?? null,
        input.phone ?? null,
        input.address ?? null,
        input.latitude,
        input.longitude,
        input.geofenceRadiusM,
        input.locationSource,
        input.locationVerified,
        input.locationAccuracyM ?? null,
        input.arrivalPromptEnabled,
        input.minDwellSeconds,
        input.cooldownMinutes,
        input.timezone ?? null,
      ]
    );

    return jsonOk({ shop: result.rows[0] }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError(409, "Shop with this externalShopCode already exists");
    }

    return jsonError(500, error instanceof Error ? error.message : "Could not create shop");
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

