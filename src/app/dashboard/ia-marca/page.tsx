"use client";

import { useMemo, useState } from "react";
import { Volume2, Users2, Globe2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { useT } from "@/lib/i18n";

type BrandDNA = {
  tone: string;
  audience: string;
  values: string[];
  website: string;
  networks: string;
};

const DEFAULT: BrandDNA = {
  tone: "",
  audience: "",
  values: [],
  website: "",
  networks: "",
};

export default function IAdeMarcaPage() {
  const t = useT(); // t("brandAIPage.xxx")
  const locale = useLocale();
  const [form, setForm] = useState<BrandDNA>(DEFAULT);
  const [newValue, setNewValue] = useState("");
  const [success, setSuccess] = useState(false);

  // Chips de ejemplo bilingües (rápido y sin depender del JSON)
  const EXAMPLES = useMemo(() => {
    if (locale === "en") {
      return {
        tone: [
          "Professional",
          "Fun",
          "Friendly",
          "Inspirational",
          "Formal",
          "Youthful",
          "Informal",
          "Academic",
        ],
        values: [
          "Innovation",
          "Empathy",
          "Trust",
          "Transparency",
          "Creativity",
          "Sustainability",
          "Quality",
          "Closeness",
          "Inclusion",
        ],
      };
    }
    return {
      tone: [
        "Profesional",
        "Divertido",
        "Cercano",
        "Inspirador",
        "Formal",
        "Joven",
        "Informal",
        "Académico",
      ],
      values: [
        "Innovación",
        "Empatía",
        "Confianza",
        "Transparencia",
        "Creatividad",
        "Sostenibilidad",
        "Calidad",
        "Cercanía",
        "Inclusión",
      ],
    };
  }, [locale]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addValue = (v?: string) => {
    const value = (v || newValue).trim();
    if (value && !form.values.includes(value)) {
      setForm({ ...form, values: [...form.values, value] });
      setNewValue("");
    }
  };

  const removeValue = (value: string) => {
    setForm({ ...form, values: form.values.filter((v) => v !== value) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: POST a tu API con `form`
    setSuccess(true);
    setTimeout(() => setSuccess(false), 1800);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center bg-background py-10 px-2">
      <div className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-lg p-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="text-primary" size={28} />
          <h1 className="text-3xl font-bold text-foreground">
            {t("brandAIPage.title")}
          </h1>
        </div>

        <p className="mb-7 text-muted-foreground max-w-lg whitespace-pre-line">
          {t("brandAIPage.description")}
        </p>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          {/* Tono de voz */}
          <div>
            <label className="flex items-center gap-2 font-semibold mb-2 text-base text-foreground">
              <Volume2 className="text-primary" size={20} />
              {t("brandAIPage.toneLabel")}
            </label>

            <div className="flex flex-wrap gap-2 mb-2">
              {EXAMPLES.tone.map((tone) => (
                <button
                  type="button"
                  key={tone}
                  className={`px-3 py-1 rounded-full border text-xs font-medium transition
                    ${
                      form.tone === tone
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-foreground/80 border-border hover:bg-muted/80"
                    }`}
                  onClick={() => setForm({ ...form, tone })}
                >
                  {tone}
                </button>
              ))}
            </div>

            <input
              type="text"
              name="tone"
              value={form.tone}
              onChange={handleChange}
              placeholder={t("brandAIPage.tonePlaceholder")}
              className="w-full rounded-lg px-4 py-2 bg-card text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Público objetivo */}
          <div>
            <label className="flex items-center gap-2 font-semibold mb-2 text-base text-foreground">
              <Users2 className="text-primary" size={20} />
              {t("brandAIPage.audienceLabel")}
            </label>
            <input
              type="text"
              name="audience"
              value={form.audience}
              onChange={handleChange}
              placeholder={t("brandAIPage.audiencePlaceholder")}
              className="w-full rounded-lg px-4 py-2 bg-card text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Valores clave */}
          <div>
            <label className="flex items-center gap-2 font-semibold mb-2 text-base text-foreground">
              <Sparkles className="text-primary" size={20} />
              {t("brandAIPage.valuesLabel")}
            </label>

            <div className="flex flex-wrap gap-2 mb-2">
              {form.values.map((val) => (
                <span
                  key={val}
                  className="rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 bg-primary/15 text-foreground border border-primary/30"
                >
                  {val}
                  <button
                    type="button"
                    onClick={() => removeValue(val)}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                    aria-label="remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              {EXAMPLES.values.map(
                (v) =>
                  !form.values.includes(v) && (
                    <button
                      type="button"
                      key={v}
                      className="rounded-full px-3 py-1 text-xs bg-muted text-foreground/80 border border-border hover:bg-muted/80"
                      onClick={() => addValue(v)}
                    >
                      {v}
                    </button>
                  )
              )}
            </div>

            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={t("brandAIPage.customValuePlaceholder")}
                className="flex-1 rounded-lg px-3 py-2 text-sm bg-card text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addValue();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => addValue()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-xl text-sm"
              >
                {t("brandAIPage.addButton")}
              </button>
            </div>
          </div>

          {/* Web y redes */}
          <div>
            <label className="flex items-center gap-2 font-semibold mb-2 text-base text-foreground">
              <Globe2 className="text-primary" size={20} />
              {t("brandAIPage.websiteLabel")}
            </label>

            <input
              type="text"
              name="website"
              value={form.website}
              onChange={handleChange}
              placeholder={t("brandAIPage.websitePlaceholder")}
              className="w-full mb-2 rounded-lg px-4 py-2 bg-card text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              type="text"
              name="networks"
              value={form.networks}
              onChange={handleChange}
              placeholder={t("brandAIPage.networksPlaceholder")}
              className="w-full rounded-lg px-4 py-2 bg-card text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Botón guardar */}
          <motion.button
            type="submit"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-3 rounded-2xl shadow mt-3 transition text-lg"
            whileTap={{ scale: 0.97 }}
          >
            {t("brandAIPage.saveButton")}
          </motion.button>
        </form>

        {/* Feedback de éxito */}
        <motion.div
          initial={false}
          animate={
            success
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 0, scale: 0.8, y: 10 }
          }
          className="fixed top-12 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-semibold px-6 py-3 rounded-2xl shadow-lg z-50"
        >
          {t("brandAIPage.successMessage")}
        </motion.div>
      </div>
    </div>
  );
}
