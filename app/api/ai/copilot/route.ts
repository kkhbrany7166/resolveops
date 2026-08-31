import {
  desc,
  eq,
  inArray,
} from "drizzle-orm";

import { getDb } from "../../../../db";
import {
  requestActivity,
  serviceRequests,
  users,
} from "../../../../db/schema";


const AI_SERVICE_URL =
  process.env.RESOLVEOPS_AI_URL ?? "http://127.0.0.1:8000";

const ORGANIZATION_ID =
  "org-resolveops-demo";

const OPERATIONS_TIME_ZONE =
  "Asia/Riyadh";

const MAX_QUESTION_LENGTH =
  1500;

const MAX_HISTORY_MESSAGES =
  8;


type RequestStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "on_hold"
  | "resolved"
  | "closed";


type CopilotMessage = {
  role:
    | "user"
    | "assistant";
  content: string;
};


type CopilotResponse = {
  answer: string;
  attention_level:
    | "normal"
    | "watch"
    | "urgent";
  referenced_request_ids: string[];
  recommended_actions: string[];
  insufficient_context: boolean;
};


type ServiceRequestRow =
  typeof serviceRequests.$inferSelect;


type OperationsContext = {
  generated_at: string;
  timezone: string;
  metrics: {
    active_requests: number;
    due_today: number;
    sla_at_risk: number;
    resolved_this_month: number;
    unassigned_requests: number;
    overdue_requests: number;
  };
  active_requests: {
    id: string;
    title: string;
    description: string;
    category: string;
    priority:
      | "low"
      | "medium"
      | "high"
      | "critical";
    status: RequestStatus;
    location: string;
    assignee_name: string | null;
    due_at: string | null;
    due_at_local: string | null;
    sla_label: string;
    minutes_remaining: number | null;
    is_overdue: boolean;
  }[];
  recent_activity: {
    request_id: string;
    action: string;
    detail: string;
    created_at: string;
    created_at_local: string | null;
  }[];
};


function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


function parseDbDate(
  value: string,
) {
  if (value.includes("T")) {
    return new Date(value);
  }

  return new Date(
    `${value.replace(" ", "T")}Z`,
  );
}


function toIsoTimestamp(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  const date =
    parseDbDate(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date.toISOString();
}


function toRiyadhTimestamp(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  const date =
    parseDbDate(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  const formatted =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          OPERATIONS_TIME_ZONE,
        month:
          "long",
        day:
          "numeric",
        year:
          "numeric",
        hour:
          "numeric",
        minute:
          "2-digit",
        hour12:
          true,
      },
    ).format(date);

  return `${formatted} Riyadh time`;
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


function formatMinutes(
  totalMinutes: number,
) {
  const days =
    Math.floor(
      totalMinutes /
        (24 * 60),
    );

  const hours =
    Math.floor(
      (totalMinutes %
        (24 * 60)) /
        60,
    );

  const minutes =
    totalMinutes % 60;


  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return minutes > 0
      ? `${hours}h ${minutes}m`
      : `${hours}h`;
  }

  return `${minutes} min`;
}


function getSlaContext(
  dueAt: string | null,
  nowMs: number,
) {
  if (!dueAt) {
    return {
      sla_label:
        "Not set",
      minutes_remaining:
        null,
      is_overdue:
        false,
    };
  }

  const dueMs =
    parseDbDate(
      dueAt,
    ).getTime();

  if (
    Number.isNaN(dueMs)
  ) {
    return {
      sla_label:
        "Unknown",
      minutes_remaining:
        null,
      is_overdue:
        false,
    };
  }

  const difference =
    dueMs - nowMs;

  const isOverdue =
    difference < 0;

  if (
    Math.abs(difference) <
    30_000
  ) {
    return {
      sla_label:
        "Due now",
      minutes_remaining:
        0,
      is_overdue:
        isOverdue,
    };
  }

  const totalMinutes =
    Math.ceil(
      Math.abs(difference) /
        60_000,
    );

  const minutesRemaining =
    isOverdue
      ? -totalMinutes
      : totalMinutes;

  const timeText =
    formatMinutes(
      totalMinutes,
    );

  return {
    sla_label:
      isOverdue
        ? `Overdue ${timeText}`
        : timeText,
    minutes_remaining:
      minutesRemaining,
    is_overdue:
      isOverdue,
  };
}


function isActiveRequest(
  request: ServiceRequestRow,
) {
  return (
    request.status !== "resolved" &&
    request.status !== "closed"
  );
}


function parseHistory(
  value: unknown,
) {
  if (value === undefined) {
    return {
      ok: true as const,
      history: [] as CopilotMessage[],
    };
  }

  if (!Array.isArray(value)) {
    return {
      ok: false as const,
      error:
        "history must be an array",
    };
  }

  const history: CopilotMessage[] =
    [];

  for (const message of value) {
    if (
      !isRecord(message) ||
      (
        message.role !== "user" &&
        message.role !== "assistant"
      ) ||
      typeof message.content !== "string" ||
      message.content.trim().length === 0
    ) {
      return {
        ok: false as const,
        error:
          "history messages must include role and content",
      };
    }

    history.push({
      role:
        message.role,
      content:
        message.content
          .trim()
          .slice(0, 3000),
    });
  }

  return {
    ok: true as const,
    history:
      history.slice(
        -MAX_HISTORY_MESSAGES,
      ),
  };
}


function isCopilotResponse(
  value: unknown,
): value is CopilotResponse {
  if (!isRecord(value)) {
    return false;
  }

  const attentionLevel =
    value.attention_level;

  return (
    typeof value.answer === "string" &&
    (
      attentionLevel === "normal" ||
      attentionLevel === "watch" ||
      attentionLevel === "urgent"
    ) &&
    Array.isArray(
      value.referenced_request_ids,
    ) &&
    value.referenced_request_ids.every(
      (requestId) =>
        typeof requestId === "string",
    ) &&
    Array.isArray(
      value.recommended_actions,
    ) &&
    value.recommended_actions.every(
      (action) =>
        typeof action === "string",
    ) &&
    typeof value.insufficient_context ===
      "boolean"
  );
}


async function buildOperationsContext(): Promise<OperationsContext> {
  const db = getDb();

  const [requestRows, userRows] =
    await Promise.all([
      db
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
        ),

      db
        .select({
          id:
            users.id,

          fullName:
            users.fullName,
        })
        .from(users)
        .where(
          eq(
            users.organizationId,
            ORGANIZATION_ID,
          ),
        ),
    ]);


  const now =
    new Date();

  const nowMs =
    now.getTime();

  const todayKey =
    getDateKey(now);

  const currentMonthKey =
    getMonthKey(now);

  const activeRequests =
    requestRows.filter(
      isActiveRequest,
    );

  const userById =
    new Map(
      userRows.map(
        (user) => [
          user.id,
          user.fullName,
        ],
      ),
    );

  const activeRequestIds =
    activeRequests.map(
      (request) =>
        request.id,
    );

  const recentActivity =
    activeRequestIds.length > 0
      ? await db
          .select({
            requestId:
              requestActivity.requestId,

            action:
              requestActivity.action,

            detail:
              requestActivity.detail,

            createdAt:
              requestActivity.createdAt,
          })
          .from(requestActivity)
          .where(
            inArray(
              requestActivity.requestId,
              activeRequestIds,
            ),
          )
          .orderBy(
            desc(
              requestActivity.createdAt,
            ),
          )
          .limit(20)
      : [];

  const activeRequestContext =
    activeRequests.map(
      (request) => {
        const slaContext =
          getSlaContext(
            request.dueAt,
            nowMs,
          );

        return {
          id:
            request.id,

          title:
            request.title,

          description:
            request.description,

          category:
            request.category,

          priority:
            request.priority,

          status:
            request.status,

          location:
            request.location,

          assignee_name:
            request.assigneeId
              ? userById.get(
                  request.assigneeId,
                ) ?? null
              : null,

          due_at:
            toIsoTimestamp(
              request.dueAt,
            ),

          due_at_local:
            toRiyadhTimestamp(
              request.dueAt,
            ),

          ...slaContext,
        };
      },
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

        if (
          Number.isNaN(
            dueAt.getTime(),
          )
        ) {
          return false;
        }

        return (
          getDateKey(dueAt) ===
          todayKey
        );
      },
    ).length;

  const slaRiskThreshold =
    new Date(
      nowMs +
        60 * 60 * 1000,
    );

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
          !Number.isNaN(
            dueAt.getTime(),
          ) &&
          dueAt <= slaRiskThreshold
        );
      },
    ).length;

  const resolvedThisMonth =
    requestRows.filter(
      (request) => {
        if (
          request.status !== "resolved" &&
          request.status !== "closed"
        ) {
          return false;
        }

        const updatedAt =
          parseDbDate(
            request.updatedAt,
          );

        if (
          Number.isNaN(
            updatedAt.getTime(),
          )
        ) {
          return false;
        }

        return (
          getMonthKey(
            updatedAt,
          ) ===
          currentMonthKey
        );
      },
    ).length;

  return {
    generated_at:
      now.toISOString(),
    timezone:
      OPERATIONS_TIME_ZONE,
    metrics: {
      active_requests:
        activeRequests.length,
      due_today:
        dueToday,
      sla_at_risk:
        slaAtRisk,
      resolved_this_month:
        resolvedThisMonth,
      unassigned_requests:
        activeRequests.filter(
          (request) =>
            !request.assigneeId,
        ).length,
      overdue_requests:
        activeRequestContext.filter(
          (request) =>
            request.is_overdue,
        ).length,
    },
    active_requests:
      activeRequestContext,
    recent_activity:
      recentActivity.map(
        (activity) => ({
          request_id:
            activity.requestId,
          action:
            activity.action,
          detail:
            activity.detail,
          created_at:
            toIsoTimestamp(
              activity.createdAt,
            ) ?? activity.createdAt,
          created_at_local:
            toRiyadhTimestamp(
              activity.createdAt,
            ),
        }),
      ),
  };
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
    typeof body.question !== "string" ||
    body.question.trim().length < 2
  ) {
    return Response.json(
      {
        error:
          "Question is required",
      },
      {
        status: 400,
      },
    );
  }

  const question =
    body.question.trim();

  if (
    question.length >
    MAX_QUESTION_LENGTH
  ) {
    return Response.json(
      {
        error:
          "Question is too long",
      },
      {
        status: 400,
      },
    );
  }

  const historyResult =
    parseHistory(
      body.history,
    );

  if (!historyResult.ok) {
    return Response.json(
      {
        error:
          historyResult.error,
      },
      {
        status: 400,
      },
    );
  }

  let context: OperationsContext;

  try {
    context =
      await buildOperationsContext();
  } catch (error) {
    console.error(
      "Unable to build Copilot operations context",
      error,
    );

    return Response.json(
      {
        error:
          "Unable to build live operations context",
      },
      {
        status: 500,
      },
    );
  }

  let aiResponse: Response;

  try {
    aiResponse =
      await fetch(
        `${AI_SERVICE_URL}/copilot`,
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              question,
              history:
                historyResult.history,
              context,
            }),
          cache:
            "no-store",
        },
      );
  } catch (error) {
    console.error(
      "Unable to reach ResolveOps Copilot service",
      error,
    );

    return Response.json(
      {
        error:
          "ResolveOps Copilot is temporarily unavailable.",
      },
      {
        status: 502,
      },
    );
  }

  let result: unknown;

  try {
    result =
      await aiResponse.json();
  } catch {
    return Response.json(
      {
        error:
          "ResolveOps Copilot returned an invalid response.",
      },
      {
        status: 502,
      },
    );
  }

  if (!aiResponse.ok) {
    console.error(
      "ResolveOps Copilot service returned an error",
      {
        status:
          aiResponse.status,
        result,
      },
    );

    return Response.json(
      {
        error:
          "ResolveOps Copilot is temporarily unavailable.",
      },
      {
        status: 502,
      },
    );
  }

  if (
    !isCopilotResponse(
      result,
    )
  ) {
    console.error(
      "ResolveOps Copilot returned malformed JSON",
      result,
    );

    return Response.json(
      {
        error:
          "ResolveOps Copilot returned an invalid response.",
      },
      {
        status: 502,
      },
    );
  }

  return Response.json(
    result,
  );
}
