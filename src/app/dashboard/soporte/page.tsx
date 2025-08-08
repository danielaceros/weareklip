"use client";

import { useEffect } from "react";
import { LifeBuoy } from "lucide-react";

export default function SupportPage() {
  useEffect(() => {
    // Cargar el widget de Zoho Desk
    const script = document.createElement("script");
    script.src =
      "https://desk.zoho.eu/portal/api/feedbackwidget/209801000000400001?orgId=20106955370&displayType=popout";
    script.defer = true;
    document.body.appendChild(script);

    // Personalizar botón de Zoho Desk
    const tryUpdateButton = () => {
      const label = document.getElementById("feedbacklabelspan");
      if (label) {
        label.style.fontSize = "15px";
        label.style.fontWeight = "600";
        label.style.padding = "12px 22px";
        label.style.backgroundColor = "#3b82f6";
        label.style.color = "#fff";
        label.style.borderRadius = "9px";
        label.style.boxShadow = "0 2px 6px rgba(0,0,0,0.12)";
        label.style.zIndex = "9999";
        label.style.position = "fixed";
        label.style.right = "28px";
        label.style.top = "20px";
        label.style.transformOrigin = "center";
      } else {
        setTimeout(tryUpdateButton, 400);
      }
    };

    tryUpdateButton();
  }, []);

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center py-12">
      <div className="bg-white max-w-xl w-full rounded-3xl shadow-xl p-8 flex flex-col items-center gap-6">
        <LifeBuoy size={44} className="text-blue-500 mb-2" />
        <h1 className="text-2xl font-bold text-center mb-2">
          Soporte y Tickets
        </h1>
        <p className="text-gray-700 text-center">
          ¿Tienes dudas o algún problema? Contacta directamente con nuestro
          equipo de soporte.
          <br />
          <span className="block mt-2 text-sm text-blue-600">
            Puedes consultar el estado de tus tickets o abrir uno nuevo usando
            el botón de ayuda (arriba a la derecha).
          </span>
        </p>
        <div className="w-full flex flex-col items-center gap-3 mt-4">
          <span className="text-gray-500 text-sm text-center">
            💡 <b>Recuerda:</b> Selecciona el módulo sobre el que tienes dudas
            (Guiones, Vídeos, Facturación, etc.) y describe tu problema para
            recibir una respuesta más rápida.
          </span>
        </div>
        <div className="w-full flex flex-col items-center mt-6">
          {/* Placeholder visual para la experiencia */}
          <button
            className="bg-blue-600 hover:bg-blue-700 transition text-white font-semibold px-8 py-3 rounded-lg shadow"
            onClick={() => {
              // El widget de Zoho Desk se abre automáticamente al clickar el botón (si está integrado)
              const label = document.getElementById("feedbacklabelspan");
              if (label) label.click();
            }}
          >
            📩 Crear nuevo ticket de soporte
          </button>
        </div>
      </div>
    </main>
  );
}
