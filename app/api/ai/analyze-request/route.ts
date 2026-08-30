const AI_SERVICE_URL =
  process.env.RESOLVEOPS_AI_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must contain valid JSON" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${AI_SERVICE_URL}/analyze-request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(
        "ResolveOps AI service returned an error",
        result,
      );

      return Response.json(
        { error: "Unable to analyze request with AI" },
        { status: 502 },
      );
    }

    return Response.json(result);
  } catch (error) {
    console.error(
      "Unable to reach ResolveOps AI service",
      error,
    );

    return Response.json(
      { error: "AI service is unavailable" },
      { status: 502 },
    );
  }
}