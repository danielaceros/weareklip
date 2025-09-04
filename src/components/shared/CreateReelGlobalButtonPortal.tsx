"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CreateReelGlobalButton from "@/components/wizard/CreateReelGlobalButton";

export default function CreateReelGlobalButtonPortal() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // 👇 inyecta el botón directamente en <body>
  return createPortal(<CreateReelGlobalButton />, document.body);
}

