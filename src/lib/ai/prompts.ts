import type { Locale } from "@/lib/i18n";

type BuildScriptPromptOpts = {
  lang: Locale;              // 'es' | 'en' | 'fr'
  tone?: string;             // tono de voz
  audience?: string;         // público objetivo
  context?: string;          // briefing/tema del vídeo
  maxSeconds?: number;       // duración aproximada del guion
};

const LANG_LABEL: Record<Locale, string> = {
  es: "Spanish",
  en: "English",
  fr: "French",
};

export function buildScriptPrompt({
  lang,
  tone,
  audience,
  context,
  maxSeconds = 30,
}: BuildScriptPromptOpts) {
  const languageName = LANG_LABEL[lang];

  return [
    `You are a short-form video scriptwriter.`,
    `Write a concise, catchy script in ${languageName}.`,
    tone ? `Tone: ${tone}.` : null,
    audience ? `Target audience: ${audience}.` : null,
    `Length: about ${maxSeconds} seconds.`,
    `Constraints: strong hook in the first sentence, simple sentences, actionable value, and a clear CTA.`,
    context ? `Context:\n${context}` : null,
    `Return ONLY the script text (no Markdown, no preface).`,
  ]
    .filter(Boolean)
    .join("\n");
}
