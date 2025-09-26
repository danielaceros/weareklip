"use client";
import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { toast } from "sonner";
// ✅ i18n
import { useTranslations } from "next-intl";

export function useAudioForm(defaultText: string) {
  const t = useTranslations();

  const [text, setText] = useState(defaultText);
  const [user, setUser] = useState<User | null>(null);
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [languageCode, setLanguageCode] = useState("es");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0.0);
  const [speed, setSpeed] = useState(1.0);
  const [speakerBoost, setSpeakerBoost] = useState(true);
  const [loading, setLoading] = useState(false);

  // 🔑 Manejo de voces
  const loadVoices = useCallback(
    async (currentUser: User) => {
      const controller = new AbortController();

      try {
        const idToken = await currentUser.getIdToken();
        const res = await fetch(`/api/firebase/users/${currentUser.uid}/voices`, {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
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
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("❌ Error cargando voces:", err);
          toast.error(t("audioForm.toasts.loadVoicesError"));
        }
      }

      return () => controller.abort();
    },
    [voiceId, t]
  );

  // 🔑 Auth listener
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadVoices(currentUser);
      } else {
        setVoices([]);
        setVoiceId("");
      }
    });
    return () => unsub();
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
    setLanguageCode,
    stability,
    setStability,
    similarityBoost,
    setSimilarityBoost,
    style,
    setStyle,
    speed,
    setSpeed,
    speakerBoost,
    setSpeakerBoost,
    loading,
    setLoading,
  };
}
