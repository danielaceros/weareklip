// src/components/audio/useAudioForm.ts
"use client";
import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { toast } from "sonner";
// ✅ i18n
import { useTranslations } from "next-intl";

const MIN_SPEED = 0.7;
const MAX_SPEED = 1.2;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const normalizeLocale = (lang?: string): "es" | "en" | "fr" => {
  return (["es", "en", "fr"].includes(String(lang)) ? lang : "es") as
    | "es"
    | "en"
    | "fr";
};

export function useAudioForm(defaultText: string) {
  const t = useTranslations();

  const [text, setText] = useState(defaultText);
  const [user, setUser] = useState<User | null>(null);
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [languageCode, _setLanguageCode] = useState<"es" | "en" | "fr">("es");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0.0);
  const [speed, _setSpeed] = useState(1.0);
  const [speakerBoost, setSpeakerBoost] = useState(true);
  const [loading, setLoading] = useState(false);

  // Aliases normalizados para compatibilidad
  const language = languageCode;
  const setLanguage = useCallback(
    (val: string) => _setLanguageCode(normalizeLocale(val)),
    []
  );

  const setLanguageCode = useCallback(
    (val: string) => _setLanguageCode(normalizeLocale(val)),
    []
  );

  // setSpeed siempre clamp (0.7–1.2)
  const setSpeed = useCallback((val: number) => {
    _setSpeed(clamp(val, MIN_SPEED, MAX_SPEED));
  }, []);

  // 🔑 Carga de voces (con cancelación segura)
  const loadVoices = useCallback(
    async (currentUser: User, signal?: AbortSignal) => {
      try {
        const idToken = await currentUser.getIdToken();
        const res = await fetch(`/api/firebase/users/${currentUser.uid}/voices`, {
          headers: { Authorization: `Bearer ${idToken}` },
          signal,
        });

        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();

        const loadedVoices: { id: string; name: string }[] = data.map((v: any) => ({
          id: v.id,
          name: v.name || v.id,
        }));

        setVoices(loadedVoices);

        if (loadedVoices.length === 0) {
          toast.warning(t("audioForm.toasts.noVoices"));
        } else if (!voiceId) {
          // 👌 Selecciona primera voz automáticamente
          setVoiceId(loadedVoices[0].id);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return; // petición cancelada
        console.error("❌ Error cargando voces:", err);
        toast.error(t("audioForm.toasts.loadVoicesError"));
      }
    },
    [voiceId, t]
  );

  // 🔑 Auth listener + cancelación de fetch al cambiar usuario/desmontar
  useEffect(() => {
    const auth = getAuth();
    let controller: AbortController | null = null;

    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (controller) controller.abort();
        controller = new AbortController();
        loadVoices(currentUser, controller.signal);
      } else {
        if (controller) {
          controller.abort();
          controller = null;
        }
        setVoices([]);
        setVoiceId("");
      }
    });

    return () => {
      unsub();
      if (controller) controller.abort();
    };
  }, [loadVoices]);

  // 🔑 Texto inicial desde guion
  useEffect(() => {
    if (defaultText) {
      toast.message(t("audioForm.toasts.loadedFromScript"));
    }
  }, [defaultText, t]);

  return {
    text,
    setText,
    user,
    voices,
    voiceId,
    setVoiceId,
    languageCode,
    setLanguageCode, // setter clamped/normalizado
    language,        // alias normalizado para conveniencia
    setLanguage,     // alias normalizado
    stability,
    setStability,
    similarityBoost,
    setSimilarityBoost,
    style,
    setStyle,
    speed,           // ya viene clamp 0.7–1.2
    setSpeed,        // setter clamp
    speakerBoost,
    setSpeakerBoost,
    loading,
    setLoading,
  };
}
