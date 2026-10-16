import { and, count, desc, eq, like, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { bills } from "../../../db/schema";
import { authenticatedAdmin } from "../../../lib/admin-auth";
const number = (value: unknown) => Math.max(0, Number(value) || 0);
async function syncBillToGoogleSheet(bill: typeof bills.$inferSelect) {
  if (!env.GOOGLE_SHEETS_WEBHOOK_URL || !env.GOOGLE_SHEETS_SECRET_KEY)
    return false;
  const payload = JSON.stringify({
        secretKey: env.GOOGLE_SHEETS_SECRET_KEY,
        billNumber: bill.billNumber,
        date: bill.createdAt,
        customerName: bill.customerName,
        customerMobile: bill.customerMobile,
        workType: bill.workType,
        workLocation: bill.workLocation,
        quantity: bill.quantity,
        rate: bill.rate,
        total: bill.total,
        amountPaid: bill.amountPaid,
        balance: bill.balance,
        paymentMode: bill.paymentMode,
        billType: bill.billType,
        projectRef: bill.projectRef,
        previousPaid: bill.previousPaid,
        currentReceived: bill.currentReceived,
      });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 500 : 1500));
    try {
      const response = await fetch(env.GOOGLE_SHEETS_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(4000), body: payload });
      const result = (await response.json().catch(() => null)) as { success?: boolean } | null;
      if (response.ok && result?.success === true) return true;
    } catch {
      // The D1 bill is already safe; retry this independent Sheet copy.
    }
  }
  return false;
}
export async function DELETE(request: Request) {
  try {
    const query = new URL(request.url).searchParams,
      billNumber = query.get("billNumber");
    if (!(await authenticatedAdmin(request)))
      return Response.json(
        { error: "Your admin session has expired. Please sign in again." },
        { status: 403 },
      );
    if (!billNumber || !/^\d{6}$/.test(billNumber))
      return Response.json(
        { error: "A valid bill number is required." },
        { status: 400 },
      );
    const deleted = await getDb()
      .delete(bills)
      .where(eq(bills.billNumber, billNumber))
      .returning({ billNumber: bills.billNumber });
    if (!deleted.length)
      return Response.json(
        { error: "The bill was not found." },
        { status: 404 },
      );
    return Response.json({ success: true, billNumber });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Bill could not be deleted.",
      },
      { status: 500 },
    );
  }
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams,
      adminView = query.get("admin") === "1",
      customerMobile = query.get("customerMobile"),
      billNumber = query.get("billNumber"),
      lookup = String(query.get("lookup") || "").replace(/\D/g, ""),
      db = getDb();
    if (adminView) {
      if (!(await authenticatedAdmin(request)))
        return Response.json(
          { error: "Your admin session has expired. Please sign in again." },
          { status: 403 },
        );
      const page = Math.max(1, Number(query.get("page")) || 1),
        pageSize = 15,
        workType = String(query.get("workType") || ""),
        search = String(query.get("search") || "").trim(),
        conditions = [];
      if (workType) conditions.push(like(bills.workType, `${workType}%`));
      if (search)
        conditions.push(
          or(
            like(bills.billNumber, `%${search}%`),
            like(bills.customerMobile, `%${search}%`),
            like(bills.customerName, `%${search}%`),
            like(bills.projectRef, `%${search}%`),
          )!,
        );
      const where = conditions.length ? and(...conditions) : undefined;
      const [{ total }] = await db.select({ total: count() }).from(bills).where(where);
      return Response.json({
        bills: await db.select().from(bills).where(where).orderBy(desc(bills.id)).limit(pageSize).offset((page - 1) * pageSize),
        total,
        page,
        pageSize,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }
    if (lookup) {
      if (/^\d{6}$/.test(lookup)) {
        const [bill] = await db
          .select()
          .from(bills)
          .where(eq(bills.billNumber, lookup))
          .limit(1);
        return Response.json({ bills: bill ? [bill] : [] });
      }
      if (/^\d{10}$/.test(lookup)) {
        const matches = await db
          .select()
          .from(bills)
          .where(eq(bills.customerMobile, lookup))
          .orderBy(desc(bills.id))
          .limit(50);
        return Response.json({ bills: matches });
      }
      return Response.json(
        { error: "Enter a 6-digit bill number or 10-digit customer mobile number." },
        { status: 400 },
      );
    }
    if (customerMobile || billNumber) {
      if (!billNumber || !/^\d{6}$/.test(billNumber))
        return Response.json(
          { error: "Enter the 6-digit bill number shown on your receipt." },
          { status: 400 },
        );
      if (!customerMobile || !/^\d{10}$/.test(customerMobile))
        return Response.json(
          { error: "Enter the same valid 10-digit customer mobile number." },
          { status: 400 },
        );
      const [bill] = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.billNumber, billNumber),
            eq(bills.customerMobile, customerMobile),
          ),
        )
        .limit(1);
      return Response.json({ bills: bill ? [bill] : [] });
    }
    return Response.json(
      { error: "A bill number and customer mobile number are required." },
      { status: 400 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Bills could not be retrieved.",
      },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!(await authenticatedAdmin(request)))
      return Response.json(
        { error: "Your admin session has expired. Please sign in again." },
        { status: 403 },
      );
    const customerName = String(body.customerName || "").trim(),
      customerMobile = String(body.customerMobile || "").trim(),
      workType = String(body.workType || "").trim(),
      workLocation = String(body.workLocation || "").trim(),
      paymentMode = String(body.paymentMode || "").trim(),
      requestKey = String(body.requestKey || "").trim(),
      db = getDb();
    if (
      !customerName ||
      !/^\d{10}$/.test(customerMobile) ||
      !workType ||
      !workLocation ||
      !requestKey
    )
      return Response.json(
        { error: "Complete all customer and work details correctly." },
        { status: 400 },
      );
    const [existingBill] = await db
      .select()
      .from(bills)
      .where(eq(bills.requestKey, requestKey))
      .limit(1);
    if (existingBill)
      return Response.json({
        bill: existingBill,
        sheetSynced: true,
        existing: true,
      });
    const quantity = number(body.quantity),
      rate = number(body.rate),
      moramQty = Math.floor(number(body.moramQty)),
      previousPaid = number(body.previousPaid),
      currentReceived = number(body.currentReceived ?? body.amountPaid),
      amountPaid = previousPaid + currentReceived;
    if (!quantity || !rate)
      return Response.json(
        { error: "Quantity and rate must be greater than zero." },
        { status: 400 },
      );
    const serviceFee = 499,
      total = quantity * rate + moramQty * 4000 + serviceFee,
      balance = total - amountPaid,
      billType = String(body.billType || "Progress Bill"),
      projectRef = String(
        body.projectRef || `PRJ-${Math.floor(100000 + Math.random() * 900000)}`,
      );
    for (let attempt = 0; attempt < 12; attempt++) {
      const billNumber = String(Math.floor(100000 + Math.random() * 900000));
      try {
        const [bill] = await db
          .insert(bills)
          .values({
            billNumber,
            customerName,
            customerMobile,
            workType,
            workLocation,
            quantity,
            rate,
            moramQty,
            serviceFee,
            total,
            amountPaid,
            balance,
            paymentMode,
            billType,
            projectRef,
            previousPaid,
            currentReceived,
            requestKey,
          })
          .returning();
        const sheetSynced = await syncBillToGoogleSheet(bill);
        return Response.json({ bill, sheetSynced }, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const [existingBill] = await db
          .select()
          .from(bills)
          .where(eq(bills.requestKey, requestKey))
          .limit(1);
        if (existingBill)
          return Response.json({
            bill: existingBill,
            sheetSynced: true,
            existing: true,
          });
        if (!message.toLowerCase().includes("unique")) throw error;
      }
    }
    return Response.json(
      { error: "Could not allocate a bill number. Please retry." },
      { status: 503 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Bill could not be created.",
      },
      { status: 500 },
    );
  }
}
