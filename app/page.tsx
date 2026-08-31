"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import NewRequestButton from "./components/NewRequestButton";

type IconName =
  | "grid"
  | "ticket"
  | "team"
  | "building"
  | "report"
  | "settings"
  | "search"
  | "bell"
  | "plus"
  | "arrow"
  | "clock"
  | "warning"
  | "check"
  | "pulse";

type ApiRequest = {
  id: string;
  organizationId: string;
  requesterId: string;
  assigneeId: string | null;
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  status:
    | "new"
    | "assigned"
    | "in_progress"
    | "on_hold"
    | "resolved"
    | "closed";
  location: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RequestsResponse = {
  requests: ApiRequest[];
  count: number;
};

type RequestRow = {
  id: string;
  title: string;
  location: string;
  category: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  status: "New" | "Assigned" | "In progress" | "On hold";
  assignee: string;
  initials: string;
  sla: string;
  risk?: boolean;
};

const navItems: {
  label: string;
  icon: IconName;
  active?: boolean;
}[] = [
  {
    label: "Overview",
    icon: "grid",
    active: true,
  },
  {
    label: "Requests",
    icon: "ticket",
  },
  {
    label: "Technicians",
    icon: "team",
  },
  {
    label: "Sites & assets",
    icon: "building",
  },
  {
    label: "Reports",
    icon: "report",
  },
];

function formatCategory(category: string) {
  if (category === "hvac") {
    return "HVAC";
  }

  return (
    category.charAt(0).toUpperCase() +
    category.slice(1)
  );
}

function formatPriority(
  priority: ApiRequest["priority"],
): RequestRow["priority"] {
  const values = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  } as const;

  return values[priority];
}

function formatStatus(
  status: ApiRequest["status"],
): RequestRow["status"] {
  switch (status) {
    case "assigned":
      return "Assigned";

    case "in_progress":
      return "In progress";

    case "on_hold":
      return "On hold";

    default:
      return "New";
  }
}

function toRequestRow(
  request: ApiRequest,
): RequestRow {
  return {
    id: request.id,
    title: request.title,
    location: request.location,
    category: formatCategory(
      request.category,
    ),
    priority: formatPriority(
      request.priority,
    ),
    status: formatStatus(
      request.status,
    ),
    assignee: request.assigneeId
      ? "Assigned"
      : "Unassigned",
    initials: request.assigneeId
      ? "AS"
      : "—",
    sla: request.dueAt
      ? "Scheduled"
      : "Not set",
    risk:
      request.priority ===
      "critical",
  };
}

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const paths: Record<
    IconName,
    ReactNode
  > = {
    grid: (
      <>
        <rect
          x="3"
          y="3"
          width="7"
          height="7"
          rx="1"
        />
        <rect
          x="14"
          y="3"
          width="7"
          height="7"
          rx="1"
        />
        <rect
          x="3"
          y="14"
          width="7"
          height="7"
          rx="1"
        />
        <rect
          x="14"
          y="14"
          width="7"
          height="7"
          rx="1"
        />
      </>
    ),

    ticket: (
      <>
        <path d="M4 5.5h16v4a2.5 2.5 0 0 0 0 5v4H4v-4a2.5 2.5 0 0 0 0-5v-4Z" />
        <path d="M9 8v8" />
      </>
    ),

    team: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle
          cx="9"
          cy="7"
          r="4"
        />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),

    building: (
      <>
        <rect
          x="4"
          y="2"
          width="16"
          height="20"
          rx="1"
        />
        <path d="M9 22v-4h6v4M8 6h2M14 6h2M8 10h2M14 10h2M8 14h2M14 14h2" />
      </>
    ),

    report: (
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
    ),

    settings: (
      <>
        <circle
          cx="12"
          cy="12"
          r="3"
        />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.36.21.74.2 1.1" />
      </>
    ),

    search: (
      <>
        <circle
          cx="11"
          cy="11"
          r="7"
        />
        <path d="m20 20-4-4" />
      </>
    ),

    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),

    plus: (
      <path d="M12 5v14M5 12h14" />
    ),

    arrow: (
      <path d="M5 12h14M13 6l6 6-6 6" />
    ),

    clock: (
      <>
        <circle
          cx="12"
          cy="12"
          r="9"
        />
        <path d="M12 7v5l3 2" />
      </>
    ),

    warning: (
      <>
        <path d="M10.3 3.6 2.4 18a2 2 0 0 0 1.75 3h15.7a2 2 0 0 0 1.75-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),

    check: (
      <>
        <circle
          cx="12"
          cy="12"
          r="9"
        />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),

    pulse: (
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  tone:
    | "teal"
    | "orange"
    | "red"
    | "blue";
}) {
  return (
    <article className="metric-card">
      <div
        className={`metric-icon ${tone}`}
      >
        <Icon
          name={icon}
          size={20}
        />
      </div>

      <div>
        <p className="metric-label">
          {label}
        </p>

        <div className="metric-line">
          <strong>{value}</strong>
          <span>{detail}</span>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [
    requests,
    setRequests,
  ] = useState<RequestRow[]>([]);

  const [
    activeRequestCount,
    setActiveRequestCount,
  ] = useState(0);

  const [
    isLoadingRequests,
    setIsLoadingRequests,
  ] = useState(true);

  const [
    requestError,
    setRequestError,
  ] = useState("");

  const loadRequests =
    useCallback(async () => {
      try {
        setRequestError("");

        const response =
          await fetch(
            "/api/requests",
            {
              cache: "no-store",
            },
          );

        const result =
          (await response.json()) as
            | RequestsResponse
            | {
                error?: string;
              };

        if (!response.ok) {
          throw new Error(
            "error" in result &&
              result.error
              ? result.error
              : "Unable to load requests.",
          );
        }

        const data =
          result as RequestsResponse;

        setRequests(
          data.requests.map(
            toRequestRow,
          ),
        );

        setActiveRequestCount(
          data.count,
        );
      } catch (error) {
        setRequestError(
          error instanceof Error
            ? error.message
            : "Unable to load requests.",
        );
      } finally {
        setIsLoadingRequests(
          false,
        );
      }
    }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>

          <div>
            <strong>
              ResolveOps
            </strong>

            <small>
              Service operations
            </small>
          </div>
        </div>

        <nav aria-label="Primary navigation">
          <p className="nav-label">
            Workspace
          </p>

          {navItems.map(
            (item) => (
              <a
                href={
                  item.active
                    ? "#overview"
                    : "#active-requests"
                }
                className={
                  item.active
                    ? "active"
                    : ""
                }
                key={item.label}
              >
                <Icon
                  name={item.icon}
                />

                <span>
                  {item.label}
                </span>

                {item.label ===
                  "Requests" && (
                  <em>
                    {
                      activeRequestCount
                    }
                  </em>
                )}
              </a>
            ),
          )}

          <p className="nav-label second">
            Management
          </p>

          <a href="#system">
            <Icon name="settings" />
            <span>Settings</span>
          </a>
        </nav>

        <div
          className="sidebar-status"
          id="system"
        >
          <div className="status-dot" />

          <div>
            <strong>
              All systems operational
            </strong>

            <span>
              Last checked just now
            </span>
          </div>
        </div>

        <div className="profile">
          <div className="avatar">
            KK
          </div>

          <div>
            <strong>
              Khalid Khubrani
            </strong>

            <span>
              Operations manager
            </span>
          </div>

          <button
            aria-label="Open account menu"
          >
            •••
          </button>
        </div>
      </aside>

      <section
        className="main-panel"
        id="overview"
      >
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark">
              <span />
              <span />
              <span />
            </div>

            <strong>
              ResolveOps
            </strong>
          </div>

          <label className="search-box">
            <Icon
              name="search"
              size={17}
            />

            <input
              type="search"
              placeholder="Search requests, sites, or assets"
              aria-label="Search"
            />

            <kbd>⌘ K</kbd>
          </label>

          <div className="top-actions">
            <button
              className="language"
              aria-label="Switch language"
            >
              EN{" "}
              <span>
                / العربية
              </span>
            </button>

            <button
              className="icon-button"
              aria-label="Notifications"
            >
              <Icon name="bell" />
              <i />
            </button>

            <NewRequestButton
              onRequestCreated={
                loadRequests
              }
            />
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">
                Sunday, 23 August
              </p>

              <h1>
                Good evening, Khalid
              </h1>

              <p>
                Monitor requests,
                technicians, and SLA
                performance from one
                place.
              </p>
            </div>

            <div className="live-status">
              <span />
              Live operations
            </div>
          </section>

          <section
            className="metrics"
            aria-label="Operations summary"
          >
            <MetricCard
              label="Active requests"
              value={String(
                activeRequestCount,
              )}
              detail={
                isLoadingRequests
                  ? "Loading..."
                  : "Live from D1"
              }
              icon="ticket"
              tone="teal"
            />

            <MetricCard
              label="Due today"
              value="6"
              detail="2 completed"
              icon="clock"
              tone="orange"
            />

            <MetricCard
              label="SLA at risk"
              value="3"
              detail="Needs action"
              icon="warning"
              tone="red"
            />

            <MetricCard
              label="Resolved this month"
              value="147"
              detail="↑ 18%"
              icon="check"
              tone="blue"
            />
          </section>

          <section className="workspace-grid">
            <article
              className="requests-panel"
              id="active-requests"
            >
              <div className="panel-heading">
                <div>
                  <h2>
                    Active requests
                  </h2>

                  <p>
                    Live service
                    requests from D1
                  </p>
                </div>

                <a href="#active-requests">
                  View all

                  <Icon
                    name="arrow"
                    size={15}
                  />
                </a>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assignee</th>
                      <th>
                        SLA remaining
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {isLoadingRequests && (
                      <tr>
                        <td colSpan={5}>
                          Loading
                          requests...
                        </td>
                      </tr>
                    )}

                    {!isLoadingRequests &&
                      requestError && (
                        <tr>
                          <td colSpan={5}>
                            {
                              requestError
                            }
                          </td>
                        </tr>
                      )}

                    {!isLoadingRequests &&
                      !requestError &&
                      requests.length ===
                        0 && (
                        <tr>
                          <td colSpan={5}>
                            No active
                            requests yet.
                          </td>
                        </tr>
                      )}

                    {!isLoadingRequests &&
                      !requestError &&
                      requests.map(
                        (request) => (
                          <tr
                            key={
                              request.id
                            }
                          >
                            <td>
                              <div className="request-title">
                                <span>
                                  {
                                    request.id
                                  }
                                </span>

                                <strong>
                                  {
                                    request.title
                                  }
                                </strong>

                                <small>
                                  {
                                    request.location
                                  }
                                  {" · "}
                                  {
                                    request.category
                                  }
                                </small>
                              </div>
                            </td>

                            <td>
                              <span
                                className={`badge priority ${request.priority.toLowerCase()}`}
                              >
                                <i />
                                {
                                  request.priority
                                }
                              </span>
                            </td>

                            <td>
                              <span
                                className={`badge status ${request.status
                                  .toLowerCase()
                                  .replace(
                                    " ",
                                    "-",
                                  )}`}
                              >
                                {
                                  request.status
                                }
                              </span>
                            </td>

                            <td>
                              <div className="assignee">
                                <span>
                                  {
                                    request.initials
                                  }
                                </span>

                                {
                                  request.assignee
                                }
                              </div>
                            </td>

                            <td>
                              <span
                                className={
                                  request.risk
                                    ? "sla risk"
                                    : "sla"
                                }
                              >
                                {request.risk && (
                                  <Icon
                                    name="warning"
                                    size={14}
                                  />
                                )}

                                {
                                  request.sla
                                }
                              </span>
                            </td>
                          </tr>
                        ),
                      )}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="side-insights">
              <article className="insight-card">
                <div className="panel-heading compact">
                  <div>
                    <h2>
                      Team capacity
                    </h2>

                    <p>
                      Today&apos;s
                      technician
                      workload
                    </p>
                  </div>

                  <button
                    aria-label="More capacity options"
                  >
                    •••
                  </button>
                </div>

                <div className="capacity-ring">
                  <div>
                    <strong>
                      76%
                    </strong>

                    <span>
                      utilized
                    </span>
                  </div>
                </div>

                <div className="capacity-stats">
                  <div>
                    <strong>
                      12
                    </strong>

                    <span>
                      On shift
                    </span>
                  </div>

                  <div>
                    <strong>
                      3
                    </strong>

                    <span>
                      Available
                    </span>
                  </div>

                  <div>
                    <strong>
                      9
                    </strong>

                    <span>
                      Assigned
                    </span>
                  </div>
                </div>
              </article>

              <article className="insight-card health-card">
                <div className="health-icon">
                  <Icon name="pulse" />
                </div>

                <div>
                  <h3>
                    API & database
                    ready
                  </h3>

                  <p>
                    ResolveOps is
                    connected to the
                    request API and
                    Cloudflare D1.
                  </p>

                  <a href="/api/health">
                    Check system health

                    <Icon
                      name="arrow"
                      size={14}
                    />
                  </a>
                </div>
              </article>
            </aside>
          </section>
        </div>
      </section>
    </main>
  );
}