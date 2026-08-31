import { desc, eq } from "drizzle-orm";

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