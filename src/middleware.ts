// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/* -------------------------------------------------
   Configuración Upstash Redis + Rate Limiting
------------------------------------------------- */
const redis = Redis.fromEnv();

// ⚡ 60 reqs por IP en 60s (ajustable)
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"),
  analytics: true,
});

/* -------------------------------------------------
   Helper: obtener IP del cliente
------------------------------------------------- */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") || // Cloudflare / Vercel Edge
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || // proxies
    "unknown"
  );
}

/* -------------------------------------------------
   Helper: decodificar JWT sin verificar (claims básicos)
------------------------------------------------- */
function decodeJwt(token: string): any | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/* -------------------------------------------------
   Middleware principal
------------------------------------------------- */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/session")) {
    return NextResponse.next();
  }
  /* --- 1. Ignorar rutas públicas/estáticas --- */
  if (
    pathname.startsWith("/_next") || // bundles internos
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/public") ||
    pathname === "/" ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/verify")
  ) {
    return NextResponse.next();
  }

  /* --- 2. Rate limit en API --- */
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(req);
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests, please try again later" },
        { status: 429 }
      );
    }
  }

  /* --- 3. Zonas privadas --- */
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/checkout/callback") ||
    pathname.startsWith("/api")
  ) {
    const tokenCookie = req.cookies.get("authToken")?.value;
    const authHeader = req.headers.get("authorization");
    const bearerToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const token = tokenCookie || bearerToken;

    // Sin token → redirect login (excepto si es API, devolvemos 401 JSON)
    if (!token) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Con token → validación mínima
    const decoded = decodeJwt(token);
    if (!decoded) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }

    // Si onboarding no está completo y entra al dashboard → redirigir
    if (
      pathname.startsWith("/dashboard") &&
      decoded.onboardingCompleted === false
    ) {
      const onboardingUrl = req.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  /* --- 4. Añadir cabeceras de seguridad --- */
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  return res;
}

/* -------------------------------------------------
   Matcher: rutas que pasan por el middleware
------------------------------------------------- */
export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/checkout/callback",
    "/login",
    "/pricing",
    "/verify",
  ],
};
