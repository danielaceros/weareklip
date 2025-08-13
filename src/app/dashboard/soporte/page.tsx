// src/app/dashboard/soporte/page.tsx
"use client";

import { useEffect } from "react";
import { LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";

export default function SupportPage() {
  const t = useTranslations("supportPage");

  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://desk.zoho.eu/portal/api/feedbackwidget/209801000000400001?orgId=20106955370&displayType=popout";
    script.defer = true;
    document.body.appendChild(script);

    const cssVar = (name: string, fallback: string) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v ? `hsl(${v})` : fallback;
    };

    const applyButtonStyles = () => {
      const el = document.getElementById("feedbacklabelspan");
      if (!el) {
        setTimeout(applyButtonStyles, 300);
        return;
      }

      const isDark = document.documentElement.classList.contains("dark");
      const primary = cssVar("--primary", "#3b82f6");
      const ring = cssVar("--ring", isDark ? "#374151" : "#e5e7eb");

      el.style.fontSize = "15px";
      el.style.fontWeight = "600";
      el.style.padding = "12px 22px";
      el.style.backgroundColor = primary;
      el.style.color = "#fff";
      el.style.borderRadius = "10px";
      el.style.boxShadow = `0 6px 18px ${isDark ? "rgba(0,0,0,.45)" : "rgba(0,0,0,.12)"}`;
      el.style.zIndex = "9999";
      el.style.position = "fixed";
      el.style.bottom = "20px"; // 👈 nuevo
      el.style.right = "20px";  // 👈 nuevo
      el.style.top = "";        // 👈 limpiar top
      el.style.border = `1px solid ${ring}`;
      (el.style as CSSStyleDeclaration).transformOrigin = "center";

      const panel = document.getElementById("zohofeedbackwidgetcontainer");
      if (panel) {
        panel.style.background = "transparent";
      }

      const obs = new MutationObserver(() => {
        const nowDark = document.documentElement.classList.contains("dark");
        el.style.backgroundColor = cssVar("--primary", "#3b82f6");
        el.style.boxShadow = `0 6px 18px ${nowDark ? "rgba(0,0,0,.45)" : "rgba(0,0,0,.12)"}`;
        el.style.border = `1px solid ${cssVar("--ring", nowDark ? "#374151" : "#e5e7eb")}`;
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

      return () => obs.disconnect();
    };


    const cleanup = applyButtonStyles();

    return () => {
      if (cleanup) cleanup();
      document.body.removeChild(script);
    };
  }, []);

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center py-12 bg-background">
      <div className="max-w-xl w-full bg-card border border-border rounded-3xl shadow-sm p-8">
        <div className="flex flex-col items-center gap-6 text-foreground">
          <LifeBuoy size={44} className="text-primary" />
          <h1 className="text-2xl font-bold text-center">{t("title")}</h1>

          <p className="text-center text-muted-foreground">
            {t("description")}
            <br />
            <span className="block mt-2 text-sm text-primary">{t("instructions")}</span>
          </p>

          <div className="w-full text-center">
            <span className="text-sm text-muted-foreground">
              💡 <b>{t("tipTitle")}</b> {t("tipText")}
            </span>
          </div>

          <button
            className="bg-primary hover:opacity-90 transition text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-sm"
            onClick={() => document.getElementById("feedbacklabelspan")?.click()}
          >
            📩 {t("createTicket")}
          </button>
        </div>
      </div>
    </main>
  );
}
