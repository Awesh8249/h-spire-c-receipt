import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { bills } from "../../../../db/schema";
export async function GET(
  request: Request,
  context: { params: Promise<{ billNumber: string }> },
) {
  try {
    const { billNumber } = await context.params;
    const customerMobile = new URL(request.url).searchParams.get("customerMobile") || "";
    if (!/^\d{6}$/.test(billNumber))
      return Response.json(
        { error: "Enter a valid 6-digit bill number." },
        { status: 400 },
      );
    if (!/^\d{10}$/.test(customerMobile))
      return Response.json(
        { error: "Enter the same valid 10-digit customer mobile number." },
        { status: 400 },
      );
    const [bill] = await getDb()
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.billNumber, billNumber),
          eq(bills.customerMobile, customerMobile),
        ),
      )
      .limit(1);
    if (!bill)
      return Response.json(
        { error: "No bill matched those details." },
        { status: 404 },
      );
    return Response.json({ bill });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Bill could not be retrieved.",
      },
      { status: 500 },
    );
  }
}
