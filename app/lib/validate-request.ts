import {
  requestCategories,
  requestPriorities,
  type CreateServiceRequestInput,
  type RequestCategory,
  type RequestPriority,
} from "../types/request";

export type RequestValidationResult =
  | { ok: true; data: CreateServiceRequestInput }
  | { ok: false; error: string };

export function validateCreateRequest(
  value: unknown,
): RequestValidationResult {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Request body must be an object" };
  }

  const input = value as Record<string, unknown>;
  const { title, description, category, priority, location } = input;

  if (!isNonEmptyString(title)) {
    return { ok: false, error: "Request title is required" };
  }

  if (!isNonEmptyString(location)) {
    return { ok: false, error: "Location is required" };
  }

  if (!isNonEmptyString(description)) {
    return { ok: false, error: "Description is required" };
  }

  if (!isRequestCategory(category)) {
    return { ok: false, error: "Select a valid category" };
  }

  if (!isRequestPriority(priority)) {
    return { ok: false, error: "Select a valid priority" };
  }

  return {
    ok: true,
    data: {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      location: location.trim(),
    },
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRequestCategory(value: unknown): value is RequestCategory {
  return requestCategories.some((category) => category === value);
}

function isRequestPriority(value: unknown): value is RequestPriority {
  return requestPriorities.some((priority) => priority === value);
}