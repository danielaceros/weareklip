"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, Lock, ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function PricingPage() {
  const t = useT();

  const credits = [
    { module: t("pricing.credits.scriptAI"), credits: 2 },
    { module: t("pricing.credits.audioAI"), credits: 10 },
    { module: t("pricing.credits.videoAI"), credits: 105 },
    { module: t("pricing.credits.editAI"), credits: 33 },
    { module: t("pricing.credits.fullVideo"), credits: 150 },
  ];

  const faqs = [
    {
      q: t("pricing.faq.items.0.q"),
      a: t("pricing.faq.items.0.a"),
    },
    {
      q: t("pricing.faq.items.1.q"),
      a: t("pricing.faq.items.1.a"),
    },
    {
      q: t("pricing.faq.items.2.q"),
      a: t("pricing.faq.items.2.a"),
    },
    {
      q: t("pricing.faq.items.3.q"),
      a: t("pricing.faq.items.3.a"),
    },
    {
      q: t("pricing.faq.items.4.q"),
      a: t("pricing.faq.items.4.a"),
    },
    {
      q: t("pricing.faq.items.5.q"),
      a: t("pricing.faq.items.5.a"),
    },
    {
      q: t("pricing.faq.items.6.q"),
      a: t("pricing.faq.items.6.a"),
    },
    {
      q: t("pricing.faq.items.7.q"),
      a: t("pricing.faq.items.7.a"),
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center py-16 px-6">
      {/* Barra superior con botón de volver */}
      <div className="w-full max-w-6xl mb-6">
        <Button asChild variant="ghost" className="gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            {t("pricing.back")}
          </Link>
        </Button>
      </div>

      {/* Título */}
      <h1 className="text-4xl font-bold mb-12">{t("pricing.title")}</h1>

      {/* Planes */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl w-full">
        <Card className="relative bg-zinc-900/40 border border-zinc-800 text-white rounded-2xl overflow-hidden blur-sm select-none">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-lg z-10"></div>
          <div className="absolute top-3 right-3 text-zinc-400 z-20">
            <Lock className="w-5 h-5" />
          </div>

          <CardHeader className="relative z-20">
            <CardTitle className="text-lg font-semibold">
              {t("pricing.plans.basic.name")}
            </CardTitle>
            <p className="text-3xl font-bold mt-2">
              {t("pricing.plans.basic.price")}{" "}
              <span className="text-base font-normal">
                {t("pricing.plans.basic.per")}
              </span>
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm filter">
            <Button className="w-full mt-2" variant="secondary" disabled>
              {t("pricing.plans.basic.cta")}
            </Button>
            <ul className="mt-6 space-y-2">
              <li>✔️ {t("pricing.plans.basic.features.0")}</li>
              <li>✔️ {t("pricing.plans.basic.features.1")}</li>
              <li>✔️ {t("pricing.plans.basic.features.2")}</li>
              <li>✔️ {t("pricing.plans.basic.features.3")}</li>
              <li>✔️ {t("pricing.plans.basic.features.4")}</li>
              <li>✔️ {t("pricing.plans.basic.features.5")}</li>
              <li>✔️ {t("pricing.plans.basic.features.6")}</li>
              <li>✔️ {t("pricing.plans.basic.features.7")}</li>
            </ul>
          </CardContent>
        </Card>

        {/* Card central - Access */}
        <Card className="relative bg-zinc-900 border border-white text-white rounded-2xl overflow-hidden scale-105 shadow-2xl z-20">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {t("pricing.plans.access.name")}
            </CardTitle>
            <p className="text-3xl font-bold mt-2">
              {t("pricing.plans.access.price")}{" "}
              <span className="text-base font-normal">
                {t("pricing.plans.access.per")}
              </span>
            </p>
            <p className="text-sm text-zinc-400 mt-2">
              {t("pricing.plans.access.trialNote")}
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Button
              className="w-full mt-2"
              variant="default"
              onClick={() =>
                (window.location.href = "https://app.viralizalo.ai")
              }
            >
              {t("pricing.plans.access.cta")}
            </Button>

            {/* Botón adicional para ir al inicio de la web */}
            <Button asChild variant="outline" className="w-full">
              <Link href="/">{t("pricing.plans.access.goHome")}</Link>
            </Button>

            <ul className="mt-6 space-y-2">
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>{t("pricing.plans.access.features.0")}</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>{t("pricing.plans.access.features.1")}</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>{t("pricing.plans.access.features.2")}</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>{t("pricing.plans.access.features.3")}</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>{t("pricing.plans.access.features.4")}</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>{t("pricing.plans.access.features.5")}</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>{t("pricing.plans.access.features.6")}</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>{t("pricing.plans.access.features.7")}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Card derecha - Pro */}
        <Card className="relative bg-zinc-900/40 border border-zinc-800 text-white rounded-2xl overflow-hidden blur-sm select-none">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-lg z-10"></div>
          <div className="absolute top-3 right-3 text-zinc-400 z-20">
            <Lock className="w-5 h-5" />
          </div>

          <CardHeader className="relative z-20">
            <CardTitle className="text-lg font-semibold">
              {t("pricing.plans.pro.name")}
            </CardTitle>
            <p className="text-3xl font-bold mt-2">
              {t("pricing.plans.pro.price")}{" "}
              <span className="text-base font-normal">
                {t("pricing.plans.pro.per")}
              </span>
            </p>
          </CardHeader>
          <CardContent className="relative z-20 space-y-3 text-sm">
            <Button className="w-full mt-2" variant="secondary" disabled>
              {t("pricing.plans.pro.cta")}
            </Button>
            <ul className="mt-6 space-y-2">
              <li>✔️ {t("pricing.plans.pro.features.0")}</li>
              <li>✔️ {t("pricing.plans.pro.features.1")}</li>
              <li>✔️ {t("pricing.plans.pro.features.2")}</li>
              <li>✔️ {t("pricing.plans.pro.features.3")}</li>
              <li>✔️ {t("pricing.plans.pro.features.4")}</li>
              <li>✔️ {t("pricing.plans.pro.features.5")}</li>
              <li>✔️ {t("pricing.plans.pro.features.6")}</li>
              <li>✔️ {t("pricing.plans.pro.features.7")}</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Créditos */}
      <div className="mt-16 bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-4xl w-full">
        <div className="grid grid-cols-5 text-center text-sm gap-4">
          {credits.map((c) => (
            <div key={c.module} className="flex flex-col items-center">
              <p className="text-white font-semibold">{c.module}</p>
              <p className="mt-2 text-zinc-400">
                {c.credits} {t("pricing.credits.unit")}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="mt-16 max-w-4xl w-full">
        <h2 className="text-2xl font-bold mb-6">{t("pricing.faq.title")}</h2>
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="border border-zinc-800 rounded-lg px-4"
            >
              <AccordionTrigger className="text-left text-white">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-zinc-400">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
