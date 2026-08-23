export const requestCategories = [
  "hvac",
  "electrical",
  "plumbing",
  "security",
  "other",
] as const;

export const requestPriorities = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const requestStatuses = [
  "new",
  "assigned",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
] as const;

export type RequestCategory = (typeof requestCategories)[number];
export type RequestPriority = (typeof requestPriorities)[number];
export type RequestStatus = (typeof requestStatuses)[number];

export interface ServiceRequest {
  id: string;
  organizationId: string;
  requesterId: string;
  assigneeId: string | null;
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  location: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateServiceRequestInput = Pick<
  ServiceRequest,
  "title" | "description" | "category" | "priority" | "location"
>;