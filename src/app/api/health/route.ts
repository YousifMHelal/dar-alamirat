import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Always evaluate at request time — this is a live DB probe.
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Runs a trivial `SELECT 1` against Neon and reports whether the
 * database connection is healthy. Returns 200 when connected, 503 when
 * not, so uptime checks can rely on the status code as well as the body.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
