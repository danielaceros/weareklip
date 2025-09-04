"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, Lock, Pointer } from "lucide-react";

export default function PricingPage() {
  const plans = [
    {
      name: "Basic",
      price: "19,99€",
      highlight: false,
      locked: true,
      features: [
        "1 voz/avatar",
        "Vídeos en 720p",
        "Cola estándar de procesamiento",
        "1 regeneración de Audio AI® gratuita",
        "1 regeneración de Script AI® gratuita",
        "Generar vídeos de hasta 30s",
        "Pago por uso de cada módulo",
        "Marca de agua incluida",
      ],
    },
    {
      name: "Access",
      price: "29,99€",
      highlight: true,
      locked: false,
      description: "Incluye 7 días de prueba + 200 créditos",
      features: [
        "1 voz/avatar",
        "Vídeos en 1080p",
        "Cola estándar de procesamiento",
        "3 regeneraciones de Audio AI® gratuitas",
        "2 regeneraciones de Script AI® gratuitas",
        "Generar vídeos de hasta 1 minuto",
        "Pago por uso de cada módulo",
        "Sin marca de agua",
      ],
    },
    {
      name: "Pro",
      price: "59,99€",
      highlight: false,
      locked: true,
      features: [
        "3 voces/avatares",
        "Vídeos en 4K",
        "Cola prioritaria de procesamiento",
        "Regeneraciones ilimitadas de Audio AI®",
        "Regeneraciones ilimitadas de Script AI®",
        "Generar vídeos de hasta 5 minutos",
        "Pago por uso de cada módulo",
        "Sin marca de agua",
      ],
    },
  ];

  const credits = [
    { module: "Script AI®", credits: 2 },
    { module: "Audio AI®", credits: 10 },
    { module: "Video AI®", credits: 105 },
    { module: "Edit AI®", credits: 33 },
    { module: "Video completo", credits: 150 },
  ];

  const faqs = [
    {
      q: "¿Hay cargos variables además de la suscripción?",
      a: "Sí. Pagas solo lo que generes según la tabla de precios por uso (vídeo completo, Video Ai®, Edit AI®, Audio AI®, Script AI®, etc.).",
    },
    {
      q: "¿Cómo y cuándo se cobra el uso?",
      a: "Agrupamos todo tu consumo en un único cargo diario a las 23:59 de la zona horaria de tu cuenta (por defecto, Europa/Madrid). Si no generas, 0 € variables ese día.",
    },
    {
      q: "¿Cómo veo el importe en euros de lo que llevo gastado hoy?",
      a: "Arriba a la derecha verás tu contador de créditos. Al pulsarlo se abre un panel con tu importe de hoy en € (IVA incl.) y lo usado este mes.",
    },
    {
      q: "¿Qué incluye “vídeo completo”?",
      a: "Video Ai® + Edit AI® + Audio AI® + Script AI® para un vídeo hasta 1 minuto. Incluye 2 regeneraciones de Script AI® y 3 de Audio AI®.",
    },
    {
      q: "¿Puedo usar módulos por separado?",
      a: "Sí. Puedes generar solo Video Ai®, Edit AI®, Audio AI® o Script AI®; se cobra cada módulo según la tabla. Si eliges “vídeo completo”, cobramos la suma de módulos en un paso.",
    },
    {
      q: "¿Qué pasa si un render falla?",
      a: "No se cobra. Reponemos los importes en tu liquidación o ajustamos el cargo diario automáticamente.",
    },
    {
      q: "¿Cómo funciona la prueba gratuita de 7 días?",
      a: "Durante los 7 días de prueba dispones de todas las funciones y no pagas la cuota mensual. Incluye 200 créditos; si los superas, el consumo adicional se cobra a precio normal por uso (con un único cargo diario a las 23:59). Si cancelas antes de que termine el trial, no se te cobra la cuota, pero se mantienen los cargos por uso que hayas hecho. Los créditos no utilizados del trial caducan al finalizar.",
    },
    {
      q: "¿Cómo activo y se aplican los 200 créditos de prueba?",
      a: "Durante el trial verás un banner “Activar 200 créditos” y debes pulsarlo para recibirlos; hasta entonces, el uso se cobra a precio normal. Si los activas ese mismo día, se descuentan primero sobre el consumo de hoy (no retroactivos) y, si los superas, el resto se cobra según tarifa; caducan al finalizar el trial.",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center py-16 px-6">
      {/* Título */}
      <h1 className="text-4xl font-bold mb-12">Precios</h1>
    
      {/* Planes */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl w-full">
        <Card className="relative bg-zinc-900/40 border border-zinc-800 text-white rounded-2xl overflow-hidden blur-sm select-none">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-lg z-10"></div>
          <div className="absolute top-3 right-3 text-zinc-400 z-20">
            <Lock className="w-5 h-5" />
          </div>

          <CardHeader className="relative z-20">
            <CardTitle className="text-lg font-semibold">Basic</CardTitle>
            <p className="text-3xl font-bold mt-2">
              19,99€ <span className="text-base font-normal">/mes + uso</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm filter">
            <Button className="w-full mt-2" variant="secondary" disabled>
              Próximamente
            </Button>
            <ul className="mt-6 space-y-2">
              <li>✔️ 1 voz/avatar</li>
              <li>✔️ Vídeos en 720p</li>
              <li>✔️ Cola estándar</li>
              <li>✔️ 1 regeneración Audio AI®</li>
              <li>✔️ 1 regeneración Script AI®</li>
              <li>✔️ Vídeos hasta 30s</li>
              <li>✔️ Pago por uso</li>
              <li>✔️ Marca de agua incluida</li>
            </ul>
          </CardContent>
        </Card>

        {/* Card central - Access */}
        <Card className="relative bg-zinc-900 border border-white text-white rounded-2xl overflow-hidden scale-105 shadow-2xl z-20">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Access</CardTitle>
            <p className="text-3xl font-bold mt-2">
              29,99€ <span className="text-base font-normal">/mes + uso</span>
            </p>
            <p className="text-sm text-zinc-400 mt-2">
              Incluye 7 días de prueba + 200 créditos
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Button
              className="w-full mt-2"
              variant="default"
              onClick={() => (window.location.href = "https://app.viralizalo.ai")}
            >
              Empieza GRATIS
            </Button>
            <ul className="mt-6 space-y-2">
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>1 voz/avatar</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>Vídeos en 1080p</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>Cola estándar</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>3 regeneraciones Audio AI®</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>2 regeneraciones Script AI®</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>Vídeos hasta 1 min</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>Pago por uso</span>
              </li>
              <li className="flex items-center gap-1">
                <Check className="w-4 h-4 text-white" />
                <span>Sin marca de agua</span>
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
            <CardTitle className="text-lg font-semibold">Pro</CardTitle>
            <p className="text-3xl font-bold mt-2">
              59,99€ <span className="text-base font-normal">/mes + uso</span>
            </p>
          </CardHeader>
          <CardContent className="relative z-20 space-y-3 text-sm">
            <Button className="w-full mt-2" variant="secondary" disabled>
              Próximamente
            </Button>
            <ul className="mt-6 space-y-2">
              <li>✔️ 3 voces/avatares</li>
              <li>✔️ Vídeos en 4K</li>
              <li>✔️ Cola prioritaria</li>
              <li>✔️ Regeneraciones ilimitadas Audio AI®</li>
              <li>✔️ Regeneraciones ilimitadas Script AI®</li>
              <li>✔️ Vídeos hasta 5 min</li>
              <li>✔️ Pago por uso</li>
              <li>✔️ Sin marca de agua</li>
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
              <p className="mt-2 text-zinc-400">{c.credits} créditos</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="mt-16 max-w-4xl w-full">
        <h2 className="text-2xl font-bold mb-6">Preguntas frecuentes</h2>
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
