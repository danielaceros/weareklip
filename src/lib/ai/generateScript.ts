import { getUserLang } from "@/lib/userLang";
import { buildScriptPrompt } from "./prompts";
import { createGuion } from "@/lib/scripts";
import type { Locale } from "@/lib/i18n";

type GenerateOpts = {
  tone?: string;
  audience?: string;
  context?: string;
  maxSeconds?: number;
  // permitir forzar idioma puntualmente (si duplicas a otro lang)
  forceLang?: Locale;
};

/**
 * Genera un guion con IA usando el idioma del usuario y lo guarda en Firestore con su `lang`.
 * Sustituye `callYourAIProvider` por tu llamada real a OpenAI/lo que uses.
 */
export async function generateScriptForUser(userId: string, opts: GenerateOpts) {
  const lang = opts.forceLang ?? (await getUserLang(userId));
  const prompt = buildScriptPrompt({ lang, ...opts });

  const scriptText = await callYourAIProvider(prompt);

  await createGuion(
    userId,
    {
      titulo: "Guion automático",
      contenido: scriptText,
      estado: 0,
    },
    lang
  );

  return { scriptText, lang };
}

// ⬇️ Reemplaza esto por tu proveedor real
async function callYourAIProvider(prompt: string): Promise<string> {
  // Ejemplo temporal:
  return `(${prompt.slice(0, 40)}...) Ejemplo de salida en el idioma solicitado.`;
}
