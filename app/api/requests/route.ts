import { and, desc, eq } from "drizzle-orm";

import { getDb } from "../../../db";

import {
  organizations,
  requestActivity,
  serviceRequests,
  users,
} from "../../../db/schema";

import { getChatGPTUser } from "../../chatgpt-auth";
import { validateCreateRequest } from "../../lib/validate-request";


const ORGANIZATION_ID =
  "org-resolveops-demo";

const OPERATIONS_TIME_ZONE =
  "Asia/Riyadh";


const SLA_HOURS = {
  critical: 1,
  high: 4,
  medium: 12,
  low: 24,
} as const;


const REQUEST_STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
] as const;


type RequestStatus =
  (typeof REQUEST_STATUSES)[number];


function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


function hasBodyField(
  body: Record<string, unknown>,
  field: string,
) {
  return Object.prototype.hasOwnProperty.call(
    body,
    field,
  );
}


function isRequestStatus(
  value: unknown,
): value is RequestStatus {
  return (
    typeof value === "string" &&
    REQUEST_STATUSES.some(
      (status) =>
        status === value,
    )
  );
}


function getSlaDeadline(
  priority:
    | "low"
    | "medium"
    | "high"
    | "critical",
) {
  const hours =
    SLA_HOURS[priority];

  return new Date(
    Date.now() +
      hours * 60 * 60 * 1000,
  ).toISOString();
}


function parseDbDate(
  value: string,
) {
  /*
   * D1 CURRENT_TIMESTAMP:
   *
   * 2026-08-30 19:34:37
   *
   * JavaScript ISO:
   *
   * 2026-08-30T19:34:37.000Z
   *
   * Normalize both as UTC.
   */

  if (value.includes("T")) {
    return new Date(value);
  }

  return new Date(
    `${value.replace(" ", "T")}Z`,
  );
}


function getDateKey(
  date: Date,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          OPERATIONS_TIME_ZONE,

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(date);


  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value;


  return `${year}-${month}-${day}`;
}


function getMonthKey(
  date: Date,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          OPERATIONS_TIME_ZONE,

        year: "numeric",
        month: "2-digit",
      },
    ).formatToParts(date);


  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value;


  return `${year}-${month}`;
}


export async function GET() {
  try {
    const db = getDb();


    const rows = await db
      .select()
      .from(serviceRequests)
      .where(
        eq(
          serviceRequests.organizationId,
          ORGANIZATION_ID,
        ),
      )
      .orderBy(
        desc(
          serviceRequests.createdAt,
        ),
      );


    const activeRequests =
      rows.filter(
        (request) =>
          request.status !==
            "resolved" &&
          request.status !==
            "closed",
      );


    const now =
      new Date();


    /*
     * Calendar calculations use
     * Riyadh local time.
     */
    const todayKey =
      getDateKey(now);

    const currentMonthKey =
      getMonthKey(now);


    /*
     * SLA risk is based on actual
     * elapsed time, so timezone
     * does not matter here.
     *
     * At risk means:
     *
     * - already overdue
     * - OR one hour or less remains
     */
    const slaRiskThreshold =
      new Date(
        now.getTime() +
          60 * 60 * 1000,
      );


    const dueToday =
      activeRequests.filter(
        (request) => {
          if (!request.dueAt) {
            return false;
          }


          const dueAt =
            parseDbDate(
              request.dueAt,
            );


          return (
            getDateKey(dueAt) ===
            todayKey
          );
        },
      ).length;


    const slaAtRisk =
      activeRequests.filter(
        (request) => {
          if (!request.dueAt) {
            return false;
          }


          const dueAt =
            parseDbDate(
              request.dueAt,
            );


          return (
            dueAt <=
            slaRiskThreshold
          );
        },
      ).length;


    const resolvedThisMonth =
      rows.filter(
        (request) => {
          if (
            request.status !==
              "resolved" &&
            request.status !==
              "closed"
          ) {
            return false;
          }


          const updatedAt =
            parseDbDate(
              request.updatedAt,
            );


          return (
            getMonthKey(
              updatedAt,
            ) ===
            currentMonthKey
          );
        },
      ).length;


    return Response.json({
      requests:
        activeRequests,

      count:
        activeRequests.length,

      metrics: {
        activeRequests:
          activeRequests.length,

        dueToday,

        slaAtRisk,

        resolvedThisMonth,
      },
    });
  } catch (error) {
    console.error(
      "Unable to load service requests",
      error,
    );


    return Response.json(
      {
        error:
          "Unable to load requests",
      },
      {
        status: 500,
      },
    );
  }
}


export async function POST(
  request: Request,
) {
  let body: unknown;


  try {
    body =
      await request.json();
  } catch {
    return Response.json(
      {
        error:
          "Request body must contain valid JSON",
      },
      {
        status: 400,
      },
    );
  }


  const validation =
    validateCreateRequest(body);


  if (!validation.ok) {
    return Response.json(
      {
        error:
          validation.error,
      },
      {
        status: 400,
      },
    );
  }


  try {
    const db = getDb();


    const authenticatedUser =
      await getChatGPTUser();


    const email =
      authenticatedUser?.email ??
      "demo@resolveops.local";


    const fullName =
      authenticatedUser?.fullName ??
      authenticatedUser?.displayName ??
      "Khalid Khubrani";


    const requesterId =
      `user:${email.toLowerCase()}`;


    const requestId =
      `WO-${crypto
        .randomUUID()
        .slice(0, 8)
        .toUpperCase()}`;


    /*
     * SLA policy:
     *
     * Critical = 1 hour
     * High     = 4 hours
     * Medium   = 12 hours
     * Low      = 24 hours
     */
    const dueAt =
      getSlaDeadline(
        validation.data.priority,
      );


    await db
      .insert(organizations)
      .values({
        id:
          ORGANIZATION_ID,

        name:
          "ResolveOps",

        slug:
          "resolveops-demo",
      })
      .onConflictDoNothing();


    await db
      .insert(users)
      .values({
        id:
          requesterId,

        organizationId:
          ORGANIZATION_ID,

        email,

        fullName,

        role:
          "manager",
      })
      .onConflictDoNothing();


    const [createdRequest] =
      await db
        .insert(
          serviceRequests,
        )
        .values({
          id:
            requestId,

          organizationId:
            ORGANIZATION_ID,

          requesterId,

          title:
            validation.data.title,

          description:
            validation.data.description,

          category:
            validation.data.category,

          priority:
            validation.data.priority,

          status:
            "new",

          location:
            validation.data.location,

          dueAt,
        })
        .returning();


    if (!createdRequest) {
      throw new Error(
        "Database did not return the created request",
      );
    }


    await db
      .insert(
        requestActivity,
      )
      .values({
        requestId,

        actorId:
          requesterId,

        action:
          "created",

        detail:
          `${fullName} created the request with a ${validation.data.priority} SLA deadline`,
      });


    return Response.json(
      {
        request:
          createdRequest,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Unable to create service request",
      error,
    );


    return Response.json(
      {
        error:
          "Unable to create request",
      },
      {
        status: 500,
      },
    );
  }
}


export async function PATCH(
  request: Request,
) {
  let body: unknown;


  try {
    body =
      await request.json();
  } catch {
    return Response.json(
      {
        error:
          "Request body must contain valid JSON",
      },
      {
        status: 400,
      },
    );
  }


  if (!isRecord(body)) {
    return Response.json(
      {
        error:
          "Request body must be a JSON object",
      },
      {
        status: 400,
      },
    );
  }


  if (
    typeof body.id !== "string" ||
    body.id.trim().length === 0
  ) {
    return Response.json(
      {
        error:
          "Request id is required",
      },
      {
        status: 400,
      },
    );
  }


  const id =
    body.id.trim();

  const assigneeSupplied =
    hasBodyField(
      body,
      "assigneeId",
    );

  const statusSupplied =
    hasBodyField(
      body,
      "status",
    );


  if (
    !assigneeSupplied &&
    !statusSupplied
  ) {
    return Response.json(
      {
        error:
          "Provide assigneeId or status to update",
      },
      {
        status: 400,
      },
    );
  }


  let assigneeId:
    | string
    | null
    | undefined;

  if (assigneeSupplied) {
    const value =
      body.assigneeId;

    if (value === null) {
      assigneeId =
        null;
    } else if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      assigneeId =
        value.trim();
    } else {
      return Response.json(
        {
          error:
            "assigneeId must be a technician user id or null",
        },
        {
          status: 400,
        },
      );
    }
  }


  let status:
    | RequestStatus
    | null =
      null;

  if (statusSupplied) {
    if (
      !isRequestStatus(
        body.status,
      )
    ) {
      return Response.json(
        {
          error:
            "Invalid request status",
        },
        {
          status: 400,
        },
      );
    }


    status =
      body.status;
  }


  try {
    const db = getDb();


    const [currentRequest] =
      await db
        .select()
        .from(serviceRequests)
        .where(
          and(
            eq(
              serviceRequests.id,
              id,
            ),
            eq(
              serviceRequests.organizationId,
              ORGANIZATION_ID,
            ),
          ),
        )
        .limit(1);


    if (!currentRequest) {
      return Response.json(
        {
          error:
            "Request not found",
        },
        {
          status: 404,
        },
      );
    }


    let assignedTechnician:
      | {
          id: string;
          fullName: string;
          email: string;
        }
      | null =
        null;


    if (
      assigneeSupplied &&
      typeof assigneeId === "string"
    ) {
      const [technician] =
        await db
          .select({
            id:
              users.id,

            fullName:
              users.fullName,

            email:
              users.email,
          })
          .from(users)
          .where(
            and(
              eq(
                users.id,
                assigneeId,
              ),
              eq(
                users.organizationId,
                ORGANIZATION_ID,
              ),
              eq(
                users.role,
                "technician",
              ),
            ),
          )
          .limit(1);


      if (!technician) {
        return Response.json(
          {
            error:
              "assigneeId must reference a technician in this organization",
          },
          {
            status: 400,
          },
        );
      }


      assignedTechnician =
        technician;
    }


    const nextAssigneeId =
      assigneeSupplied
        ? assigneeId ?? null
        : currentRequest.assigneeId;

    let nextStatus =
      currentRequest.status;

    if (status !== null) {
      nextStatus =
        status;
    }


    if (
      assigneeSupplied &&
      typeof assigneeId === "string" &&
      status === null &&
      currentRequest.status === "new"
    ) {
      nextStatus =
        "assigned";
    }


    if (
      nextStatus === "assigned" &&
      !nextAssigneeId
    ) {
      return Response.json(
        {
          error:
            "Assigned requests must have an assignee",
        },
        {
          status: 400,
        },
      );
    }


    const changes: string[] =
      [];

    const updateData:
      Partial<
        typeof serviceRequests.$inferInsert
      > =
        {};


    if (
      nextAssigneeId !==
      currentRequest.assigneeId
    ) {
      updateData.assigneeId =
        nextAssigneeId;

      changes.push(
        nextAssigneeId
          ? `assigned to ${assignedTechnician?.fullName ?? nextAssigneeId}`
          : "unassigned",
      );
    }


    if (
      nextStatus !==
      currentRequest.status
    ) {
      updateData.status =
        nextStatus;

      changes.push(
        `status changed from ${currentRequest.status} to ${nextStatus}`,
      );
    }


    if (changes.length === 0) {
      return Response.json({
        request:
          currentRequest,
      });
    }


    updateData.updatedAt =
      new Date().toISOString();


    const authenticatedUser =
      await getChatGPTUser();


    const email =
      authenticatedUser?.email ??
      "demo@resolveops.local";

    const fullName =
      authenticatedUser?.fullName ??
      authenticatedUser?.displayName ??
      "Khalid Khubrani";


    const actorId =
      `user:${email.toLowerCase()}`;


    await db
      .insert(organizations)
      .values({
        id:
          ORGANIZATION_ID,

        name:
          "ResolveOps",

        slug:
          "resolveops-demo",
      })
      .onConflictDoNothing();


    await db
      .insert(users)
      .values({
        id:
          actorId,

        organizationId:
          ORGANIZATION_ID,

        email,

        fullName,

        role:
          "manager",
      })
      .onConflictDoNothing();


    const [updatedRequest] =
      await db
        .update(
          serviceRequests,
        )
        .set(updateData)
        .where(
          and(
            eq(
              serviceRequests.id,
              id,
            ),
            eq(
              serviceRequests.organizationId,
              ORGANIZATION_ID,
            ),
          ),
        )
        .returning();


    if (!updatedRequest) {
      return Response.json(
        {
          error:
            "Request not found",
        },
        {
          status: 404,
        },
      );
    }


    await db
      .insert(
        requestActivity,
      )
      .values({
        requestId:
          id,

        actorId,

        action:
          "updated",

        detail:
          changes.join("; "),
      });


    return Response.json({
      request:
        updatedRequest,
    });
  } catch (error) {
    console.error(
      "Unable to update service request",
      error,
    );


    return Response.json(
      {
        error:
          "Unable to update request",
      },
      {
        status: 500,
      },
    );
  }
}
