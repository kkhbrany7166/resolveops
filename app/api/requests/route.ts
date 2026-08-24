import { getDb } from "../../../db";
import {
  organizations,
  requestActivity,
  serviceRequests,
  users,
} from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateCreateRequest } from "../../lib/validate-request";

const ORGANIZATION_ID = "org-waslops-demo";

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

  try {
    const db = getDb();
    const authenticatedUser = await getChatGPTUser();

    const email = authenticatedUser?.email ?? "demo@waslops.local";
    const fullName =
      authenticatedUser?.fullName ??
      authenticatedUser?.displayName ??
      "Khalid Khubrani";

    const requesterId = `user:${email.toLowerCase()}`;
    const requestId = `WO-${crypto.randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;

    await db
      .insert(organizations)
      .values({
        id: ORGANIZATION_ID,
        name: "WaslOps",
        slug: "waslops-demo",
      })
      .onConflictDoNothing();

    await db
      .insert(users)
      .values({
        id: requesterId,
        organizationId: ORGANIZATION_ID,
        email,
        fullName,
        role: "manager",
      })
      .onConflictDoNothing();

    const [createdRequest] = await db
      .insert(serviceRequests)
      .values({
        id: requestId,
        organizationId: ORGANIZATION_ID,
        requesterId,
        title: validation.data.title,
        description: validation.data.description,
        category: validation.data.category,
        priority: validation.data.priority,
        status: "new",
        location: validation.data.location,
      })
      .returning();

    if (!createdRequest) {
      throw new Error("Database did not return the created request");
    }

    await db.insert(requestActivity).values({
      requestId,
      actorId: requesterId,
      action: "created",
      detail: `${fullName} created the request`,
    });

    return Response.json(
      { request: createdRequest },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unable to create service request", error);

    return Response.json(
      { error: "Unable to create request" },
      { status: 500 },
    );
  }
}