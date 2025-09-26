"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

interface GenerateButtonProps {
  loading: boolean;
  onClick: () => void;
}

export function GenerateButton({ loading, onClick }: GenerateButtonProps) {
  const t = useT();

  const label = loading
    ? t("video.generateButton.generating")
    : t("video.generateButton.generate");

  return (
    <Button
      onClick={onClick}
      disabled={loading}
      className="w-full"
      aria-busy={loading}
      aria-disabled={loading}
      title={label}
    >
      {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
      {label}
    </Button>
  );
}
