import { NextResponse } from "next/server";
import {
  getMetricoolProfiles,
  validateMetricoolCredentials,
} from "@/lib/metricool";

// Define la estructura de perfil devuelta por Metricool.
// Añade aquí otros campos si sabes que existen, pero evita usar `any`.
interface SimpleProfile {
  id: string | number;
  fbBusinessId?: string; // ID para Instagram (business)
  facebookId?: string;
  twitterId?: string;
  // Otros campos que conozcas
}

export async function GET() {
  try {
    if (!(await validateMetricoolCredentials())) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const profiles = (await getMetricoolProfiles()) as SimpleProfile[];

    // Extrae los IDs útiles de cada perfil
    const providers = profiles.map((p) => ({
      blogId: p.id,
      instagramId: p.fbBusinessId,
      facebookId: p.facebookId,
      twitterId: p.twitterId,
    }));

    return NextResponse.json({ providers });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error interno en Metricool";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
