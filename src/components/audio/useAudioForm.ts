"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export function useAudioForm(defaultText: string) {
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

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const voicesRef = collection(db, "users", currentUser.uid, "voices");
          const snapshot = await getDocs(voicesRef);
          const loadedVoices: { id: string; name: string }[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loadedVoices.push({
              id: docSnap.id,
              name: data.name || docSnap.id,
            });
          });
          setVoices(loadedVoices);
          if (loadedVoices.length > 0) {
          } else {
            toast.warning("No tienes voces guardadas, primero crea o clona una voz.");
          }
        } catch (err) {
          console.error(err);
          toast.error("Error cargando voces desde la base de datos.");
        }
      } else {
        setVoices([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (defaultText) {
      toast.success("Texto cargado automáticamente desde el guion seleccionado");
    }
  }, [defaultText]);

  return {
    text, setText,
    user,
    voices, voiceId, setVoiceId,
    languageCode, setLanguageCode,
    stability, setStability,
    similarityBoost, setSimilarityBoost,
    style, setStyle,
    speed, setSpeed,
    speakerBoost, setSpeakerBoost,
    loading, setLoading
  };
}
