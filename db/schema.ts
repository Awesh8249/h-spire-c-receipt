// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const bills = sqliteTable(
  "bills",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    billNumber: text("bill_number").notNull().unique(),
    customerName: text("customer_name").notNull(),
    customerMobile: text("customer_mobile").notNull(),
    workType: text("work_type").notNull(),
    workLocation: text("work_location").notNull(),
    quantity: real("quantity").notNull(),
    rate: real("rate").notNull(),
    moramQty: integer("moram_qty").notNull().default(0),
    serviceFee: real("service_fee").notNull().default(499),
    total: real("total").notNull(),
    amountPaid: real("amount_paid").notNull().default(0),
    balance: real("balance").notNull(),
    paymentMode: text("payment_mode").notNull(),
    billType: text("bill_type").notNull().default("Final Bill"),
    projectRef: text("project_ref").notNull().default(""),
    previousPaid: real("previous_paid").notNull().default(0),
    currentReceived: real("current_received").notNull().default(0),
    requestKey: text("request_key").unique(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("bills_customer_mobile_idx").on(table.customerMobile),
    index("bills_project_ref_idx").on(table.projectRef),
  ],
);

export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mobile: text("mobile").notNull().unique(),
  role: text("role").notNull().default("admin"),
  pinHash: text("pin_hash"),
  pinSalt: text("pin_salt"),
  recoveryHash: text("recovery_hash"),
  recoverySalt: text("recovery_salt"),
  inviteHash: text("invite_hash"),
  inviteExpiresAt: integer("invite_expires_at"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: integer("last_login_at").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const loginSecurity = sqliteTable("login_security", {
  mobile: text("mobile").primaryKey(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockLevel: integer("lock_level").notNull().default(0),
  lockedUntil: integer("locked_until").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
