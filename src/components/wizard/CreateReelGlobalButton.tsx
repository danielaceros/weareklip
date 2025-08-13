// src/components/CreateReelGlobalButton.tsx
"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateReelWizard from "@/components/wizard/CreateReelWizard";

export default function CreateReelGlobalButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Botón flotante */}
      <div className="fixed bottom-20 right-6 z-50">
        <Button
          size="lg"
          className="rounded-full shadow-lg bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 transition-all animate-pulse text-white flex items-center gap-2"
          onClick={() => setOpen(true)}
        >
          <PlusCircle className="w-5 h-5" />
          Crear Reel IA
        </Button>
      </div>

      {/* Modal Wizard */}
      <CreateReelWizard
        open={open}
        onClose={() => setOpen(false)}
        onComplete={(data) => {
          console.log("Datos del guion aceptado:", data);
        }}
      />
    </>
  );
}
