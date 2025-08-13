"use client";

import { useEffect } from "react";

export default function ZohoDeskScript() {
  useEffect(() => {
    // Cargar el script del widget
    const script = document.createElement("script");
    script.src =
      "https://desk.zoho.eu/portal/api/feedbackwidget/209801000000400001?orgId=20106955370&displayType=popout";
    script.defer = true;
    document.body.appendChild(script);

    // Función para aplicar estilo personalizado
    const tryUpdateButton = () => {
      const label = document.getElementById("feedbacklabelspan");

      if (label) {
        label.style.fontSize = "14px";
        label.style.fontWeight = "600";
        label.style.padding = "10px 16px";
        label.style.backgroundColor = "#3b82f6";
        label.style.color = "#ffffff";
        label.style.borderRadius = "8px";
        label.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
        label.style.whiteSpace = "nowrap";
        label.style.zIndex = "9999";
        label.style.position = "fixed";
        label.style.right = "80px";
        label.style.bottom = "18px"; // 👈 ahora abajo
        label.style.top = "";        // 👈 eliminamos top
        label.style.transformOrigin = "center";
      } else {
        setTimeout(tryUpdateButton, 300);
      }
    };

    tryUpdateButton();
  }, []);

  return null;
}
