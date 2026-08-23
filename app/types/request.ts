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
  "in-progress",
  "on-hold",
  "resolved",
] as const;

export type RequestCategory = (typeof requestCategories)[number];
export type RequestPriority = (typeof requestPriorities)[number];
export type RequestStatus = (typeof requestStatuses)[number];

export interface ServiceRequest {
  id: number;
  requestNumber: string;
  title: string;
  site: string;
  category: RequestCategory;
  priority: RequestPriority;
  description: string;
  status: RequestStatus;
  createdAt: string;
}

export type CreateServiceRequestInput = Pick<
  ServiceRequest,
  "title" | "site" | "category" | "priority" | "description"
>;