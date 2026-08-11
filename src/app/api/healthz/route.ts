/**
 * Liveness. Answers "is the process up" and nothing else — deliberately does no
 * database work, so a DB outage does not make the container look dead and get
 * restarted in a loop. Readiness is `/api/readyz`.
 *
 * Convention from `fingrid-fas/src/router/health_check_route.go`.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ data: { status: "ok" } });
}
