"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";


type RequestStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "on_hold"
  | "resolved"
  | "closed";


type ManagedRequest = {
  id: string;
  assigneeId: string | null;
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
  dueAt: string | null;
};


export type Technician = {
  id: string;
  fullName: string;
  email: string;
};


type RequestManagementModalProps = {
  request: ManagedRequest | null;
  technicians: Technician[];
  isLoadingTechnicians: boolean;
  technicianError: string;
  slaRemaining: string;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
};


const STATUS_OPTIONS: {
  value: RequestStatus;
  label: string;
}[] = [
  {
    value: "new",
    label: "New",
  },
  {
    value: "assigned",
    label: "Assigned",
  },
  {
    value: "in_progress",
    label: "In progress",
  },
  {
    value: "on_hold",
    label: "On hold",
  },
  {
    value: "resolved",
    label: "Resolved",
  },
  {
    value: "closed",
    label: "Closed",
  },
];


function formatCategory(
  category: string,
) {
  if (category === "hvac") {
    return "HVAC";
  }

  return (
    category
      .charAt(0)
      .toUpperCase() +
    category.slice(1)
  );
}


function formatPriority(
  priority: ManagedRequest["priority"],
) {
  const values = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  } as const;

  return values[priority];
}


function formatStatus(
  status: RequestStatus,
) {
  const option =
    STATUS_OPTIONS.find(
      (item) =>
        item.value === status,
    );

  return option?.label ?? "New";
}


function getTechnicianName(
  assigneeId: string | null,
  technicians: Technician[],
) {
  if (!assigneeId) {
    return "Unassigned";
  }

  return (
    technicians.find(
      (technician) =>
        technician.id === assigneeId,
    )?.fullName ??
    "Current technician"
  );
}


export default function RequestManagementModal({
  request,
  technicians,
  isLoadingTechnicians,
  technicianError,
  slaRemaining,
  onClose,
  onUpdated,
}: RequestManagementModalProps) {
  const [
    assigneeId,
    setAssigneeId,
  ] = useState("");

  const [
    status,
    setStatus,
  ] =
    useState<RequestStatus>(
      "new",
    );

  const [
    error,
    setError,
  ] = useState("");

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);


  useEffect(() => {
    if (!request) {
      return;
    }

    setAssigneeId(
      request.assigneeId ?? "",
    );
    setStatus(
      request.status,
    );
    setError("");
    setIsSaving(false);
  }, [request]);


  useEffect(() => {
    if (!request) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    onClose,
    request,
  ]);


  const selectedAssigneeId =
    assigneeId || null;

  const hasAssigneeChanged =
    request
      ? selectedAssigneeId !==
        request.assigneeId
      : false;

  const hasStatusChanged =
    request
      ? status !== request.status
      : false;

  const hasChanges =
    hasAssigneeChanged ||
    hasStatusChanged;

  const willLeaveActiveTable =
    status === "resolved" ||
    status === "closed";

  const currentTechnician =
    useMemo(
      () =>
        getTechnicianName(
          request?.assigneeId ?? null,
          technicians,
        ),
      [
        request?.assigneeId,
        technicians,
      ],
    );

  const selectedStatusLabel =
    formatStatus(status);

  const selectedTechnicianIsMissing =
    Boolean(
      request?.assigneeId,
    ) &&
    !technicians.some(
      (technician) =>
        technician.id ===
        request?.assigneeId,
    );


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!request) {
      return;
    }

    setError("");

    if (
      status === "assigned" &&
      !selectedAssigneeId
    ) {
      setError(
        "Choose a technician before setting the status to Assigned.",
      );
      return;
    }

    if (!hasChanges) {
      return;
    }

    const payload: {
      id: string;
      assigneeId?: string | null;
      status?: RequestStatus;
    } = {
      id:
        request.id,
    };

    if (hasAssigneeChanged) {
      payload.assigneeId =
        selectedAssigneeId;
    }

    if (hasStatusChanged) {
      payload.status =
        status;
    }

    setIsSaving(true);

    try {
      const response =
        await fetch(
          "/api/requests",
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                payload,
              ),
          },
        );

      const result =
        (await response.json()) as {
          request?: unknown;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Unable to update request.",
        );
      }

      await onUpdated();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update request.",
      );
    } finally {
      setIsSaving(false);
    }
  }


  if (
    !request ||
    typeof document === "undefined"
  ) {
    return null;
  }


  return createPortal(
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <section
        className="request-modal management-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-request-title"
        aria-describedby="manage-request-description"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="management-header">
          <div>
            <p className="eyebrow">
              Manage request
            </p>

            <h2 id="manage-request-title">
              {request.id}
            </h2>
          </div>

          <button
            type="button"
            className="modal-close-button"
            aria-label="Close request management"
            onClick={onClose}
          >
            X
          </button>
        </div>

        <div className="management-layout">
          <div className="management-summary">
            <div>
              <h3>
                {request.title}
              </h3>

              <p
                id="manage-request-description"
                className="management-description"
              >
                {request.description}
              </p>
            </div>

            <dl className="request-detail-grid">
              <div>
                <dt>Location</dt>
                <dd>
                  {request.location}
                </dd>
              </div>

              <div>
                <dt>Category</dt>
                <dd>
                  {formatCategory(
                    request.category,
                  )}
                </dd>
              </div>

              <div>
                <dt>Priority</dt>
                <dd>
                  <span
                    className={`badge priority ${request.priority}`}
                  >
                    <i />

                    {formatPriority(
                      request.priority,
                    )}
                  </span>
                </dd>
              </div>

              <div>
                <dt>Current status</dt>
                <dd>
                  <span
                    className={`badge status ${request.status.replace(
                      "_",
                      "-",
                    )}`}
                  >
                    {formatStatus(
                      request.status,
                    )}
                  </span>
                </dd>
              </div>

              <div>
                <dt>SLA remaining</dt>
                <dd>
                  {slaRemaining}
                </dd>
              </div>

              <div>
                <dt>Current technician</dt>
                <dd>
                  {currentTechnician}
                </dd>
              </div>
            </dl>
          </div>

          <form
            className="management-form"
            onSubmit={handleSubmit}
          >
            <label htmlFor="request-technician">
              Technician
            </label>

            <select
              id="request-technician"
              value={assigneeId}
              onChange={(event) =>
                setAssigneeId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Unassigned
              </option>

              {selectedTechnicianIsMissing && (
                <option
                  value={
                    request.assigneeId ??
                    ""
                  }
                >
                  Current technician
                </option>
              )}

              {technicians.map(
                (technician) => (
                  <option
                    key={
                      technician.id
                    }
                    value={
                      technician.id
                    }
                  >
                    {
                      technician.fullName
                    }
                  </option>
                ),
              )}
            </select>

            <label htmlFor="request-status">
              Status
            </label>

            <select
              id="request-status"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target
                    .value as RequestStatus,
                )
              }
            >
              {STATUS_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </option>
                ),
              )}
            </select>

            {isLoadingTechnicians && (
              <p className="management-hint">
                Loading technicians...
              </p>
            )}

            {technicianError && (
              <p
                className="management-warning"
                role="alert"
              >
                {technicianError}
              </p>
            )}

            {willLeaveActiveTable && (
              <p className="management-removal-note">
                Saving as {selectedStatusLabel}
                {" "}
                will remove this request
                from Active requests.
              </p>
            )}

            {error && (
              <p
                className="request-error management-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="form-actions management-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  isSaving ||
                  !hasChanges
                }
              >
                {isSaving
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>,
    document.body,
  );
}
