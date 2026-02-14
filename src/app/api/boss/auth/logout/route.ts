import { jsonOk } from "@/lib/http";
import { getBossSessionCookieName } from "@/lib/boss-auth";

export async function POST() {
  const res = jsonOk({ ok: true });
  res.cookies.set({
    name: getBossSessionCookieName(),
    value: "",
    path: "/",
    maxAge: 0,
  });
  return res;
}
