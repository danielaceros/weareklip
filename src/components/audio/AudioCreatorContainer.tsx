"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAudioForm } from "./useAudioForm";
import { AudioForm } from "./AudioForm";

export default function AudioCreatorContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultText = searchParams.get("text") || "";

  const form = useAudioForm(defaultText);

  const handleGenerate = async () => {
    if (!form.text.trim()) {
      toast.error("Debes escribir el texto a convertir.");
      return;
    }
    if (!form.voiceId) {
      toast.error("Debes seleccionar una voz.");
      return;
    }
    if (!form.user) {
      toast.error("Debes iniciar sesión para generar audios.");
      return;
    }

    form.setLoading(true);
    toast.info("Generando audio, por favor espera...");

    try {
      const token = await form.user.getIdToken();
      const res = await fetch("/api/elevenlabs/audio/create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: form.text,
          voiceId: form.voiceId,
          language_code: form.languageCode,
          voice_settings: {
            stability: form.stability,
            similarity_boost: form.similarityBoost,
            style: form.style,
            speed: form.speed,
            use_speaker_boost: form.speakerBoost,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando audio");

      toast.success("✅ Audio generado correctamente");
      router.push("/dashboard/audio");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo generar el audio.");
    } finally {
      form.setLoading(false);
    }
  };

  return <AudioForm {...form} onGenerate={handleGenerate} />;
}
