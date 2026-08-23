import { env } from "cloudflare:workers";

export async function GET() {
  try {
    if (!env.DB) throw new Error("Database binding is unavailable");

    const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    const healthy = result?.ok === 1;

    return Response.json({
      status: healthy ? "healthy" : "degraded",
      service: "waslops-api",
      database: healthy ? "connected" : "unavailable",
      timestamp: new Date().toISOString(),
    }, { status: healthy ? 200 : 503 });
  } catch (error) {
    return Response.json({
      status: "unhealthy",
      service: "waslops-api",
      database: "unavailable",
      error: error instanceof Error ? error.message : "Unexpected error",
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
