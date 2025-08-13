"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { toast } from "sonner";
import { ScriptForm } from "@/components/script/ScriptForm";
import { AudioForm } from "@/components/audio/AudioForm";
import { useAudioForm } from "@/components/audio/useAudioForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ReelData {
  script: string;
  audioUrl?: string;
}

interface CreateReelWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: ReelData) => void;
}

export default function CreateReelWizard({
  open,
  onClose,
}: CreateReelWizardProps) {
  const [user, setUser] = useState<User | null>(null);

  // pasos: 1 = guion, 2 = audio
  const [step, setStep] = useState(1);

  // Datos guion
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [duration, setDuration] = useState("");
  const [language, setLanguage] = useState("es");
  const [structure, setStructure] = useState("");
  const [addCTA, setAddCTA] = useState(false);
  const [ctaText, setCtaText] = useState("");
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState("");
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

  // Datos audio
  const audioForm = useAudioForm("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
  }, []);

  // Paso 1 - Generar guion
  const generateScript = async () => {
    if (!description || !tone || !platform || !duration || !structure) {
      toast.error("Por favor, completa todos los campos obligatorios.");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión para continuar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/chatgpt/scripts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          tone,
          platform,
          duration,
          language,
          structure,
          addCTA,
          ctaText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando guion");

      setScript(data.script || "");
      setIsScriptModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el guion.");
    } finally {
      setLoading(false);
    }
  };

  const acceptScript = () => {
    audioForm.setText(script);
    setIsScriptModalOpen(false);
    setStep(2);
  };

  // Paso 2 - Generar audio
  const generateAudio = async () => {
    if (!audioForm.voiceId) {
      toast.error("Selecciona una voz antes de continuar.");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión.");
      return;
    }

    audioForm.setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/elevenlabs/audio/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: audioForm.text,
          voiceId: audioForm.voiceId,
          language_code: audioForm.languageCode,
          voice_settings: {
            stability: audioForm.stability,
            similarity_boost: audioForm.similarityBoost,
            style: audioForm.style,
            speed: audioForm.speed,
            use_speaker_boost: audioForm.speakerBoost,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando audio");

      setAudioUrl(data.audioUrl);
      setIsAudioModalOpen(true);
      toast.success("✅ Audio generado correctamente");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el audio.");
    } finally {
      audioForm.setLoading(false);
    }
  };

    const acceptAudio = () => {
    setIsAudioModalOpen(false);
    onClose();
    };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crear Reel IA</DialogTitle>
        </DialogHeader>

        {/* Paso 1 - Guion */}
        {step === 1 && (
          <>
            <ScriptForm
              description={description}
              tone={tone}
              platform={platform}
              duration={duration}
              language={language}
              structure={structure}
              addCTA={addCTA}
              ctaText={ctaText}
              loading={loading}
              setDescription={setDescription}
              setTone={setTone}
              setPlatform={setPlatform}
              setDuration={setDuration}
              setLanguage={setLanguage}
              setStructure={setStructure}
              setAddCTA={setAddCTA}
              setCtaText={setCtaText}
              onSubmit={generateScript}
            />

            {/* Modal de guion */}
            <Dialog open={isScriptModalOpen} onOpenChange={setIsScriptModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Guion generado</DialogTitle>
                </DialogHeader>
                <Textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="min-h-[200px]"
                />
                <DialogFooter className="flex justify-between">
                  <Button variant="outline" onClick={generateScript}>
                    Regenerar
                  </Button>
                  <Button onClick={acceptScript}>Aceptar y continuar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* Paso 2 - Audio */}
        {step === 2 && (
          <>
            <AudioForm {...audioForm} onGenerate={generateAudio} />

            {/* Modal de audio */}
            <Dialog open={isAudioModalOpen} onOpenChange={setIsAudioModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Audio generado</DialogTitle>
                </DialogHeader>
                {audioUrl ? (
                  <audio controls src={audioUrl} className="w-full my-4" />
                ) : (
                  <p>No se ha generado audio.</p>
                )}
                <DialogFooter className="flex justify-between">
                  <Button variant="outline" onClick={generateAudio}>
                    Regenerar
                  </Button>
                  <Button onClick={acceptAudio}>Aceptar y continuar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
