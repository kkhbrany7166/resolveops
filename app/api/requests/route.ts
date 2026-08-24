import { validateCreateRequest } from "../../lib/validate-request";

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

  const validation = validateCreateRequest(body);

  if (!validation.ok) {
    return Response.json(
      { error: validation.error },
      { status: 400 },
    );
  }

  return Response.json(
    { request: validation.data },
    { status: 200 },
  );
}