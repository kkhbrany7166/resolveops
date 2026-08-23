import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("organizations_slug_idx").on(table.slug)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["admin", "manager", "dispatcher", "technician", "requester"] }).notNull().default("requester"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
  index("users_organization_idx").on(table.organizationId),
]);

export const serviceRequests = sqliteTable("service_requests", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  requesterId: text("requester_id").notNull().references(() => users.id),
  assigneeId: text("assignee_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority", { enum: ["low", "medium", "high", "critical"] }).notNull().default("medium"),
  status: text("status", { enum: ["new", "assigned", "in_progress", "on_hold", "resolved", "closed"] }).notNull().default("new"),
  location: text("location").notNull(),
  dueAt: text("due_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("requests_organization_idx").on(table.organizationId),
  index("requests_status_idx").on(table.status),
  index("requests_assignee_idx").on(table.assigneeId),
  index("requests_due_at_idx").on(table.dueAt),
]);

export const requestActivity = sqliteTable("request_activity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: text("request_id").notNull().references(() => serviceRequests.id),
  actorId: text("actor_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("activity_request_idx").on(table.requestId)]);
