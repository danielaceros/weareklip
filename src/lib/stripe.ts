import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  throw new Error(
    "[stripe] STRIPE_SECRET_KEY no está definida (.env.local) — reinicia el servidor tras añadirla."
  );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

