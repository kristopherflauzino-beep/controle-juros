import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return fail(auth.error, auth.status);

  return ok({ user: auth.user });
}
