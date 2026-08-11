/**
 * Readiness. Pings the database and returns 503 when it is unreachable, so a
 * load balancer stops sending traffic to an instance that cannot serve it.
 *
 * This is also the fastest local diagnosis when sign-in mysteriously fails:
 * a 503 here means MySQL is down, and the sign-in callback is failing closed.
 */

import { NextResponse } from "next/server";

import { prisma } from "@/server/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ data: { status: "ready", database: "up" } });
  } catch (error) {
    console.error("[readyz] database unreachable", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_001",
          message: "Database unreachable",
          request_id: "readyz",
        },
      },
      { status: 503 },
    );
  }
}
