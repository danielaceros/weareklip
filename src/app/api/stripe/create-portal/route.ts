import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getUserFromSession, getStripeCustomerId } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { return_url } = await req.json();
    const user = await getUserFromSession(req);
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const customerId = await getStripeCustomerId(user.id);
    if (!customerId) return new NextResponse("Missing stripeCustomerId", { status: 400 });

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e) {
    console.error("[create-portal] error:", e);
    return new NextResponse("create-portal failed", { status: 500 });
  }
}
