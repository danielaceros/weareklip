"use client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface GenerateButtonProps {
  loading: boolean;
  onClick: () => void;
}

export function GenerateButton({ loading, onClick }: GenerateButtonProps) {
  return (
    <Button onClick={onClick} disabled={loading} className="w-full">
      {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
      Generar vídeo
    </Button>
  );
}

