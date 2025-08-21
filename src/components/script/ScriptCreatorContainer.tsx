"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { ScriptForm } from "./ScriptForm";

export default function ScriptCreatorContainer() {
  const [user, setUser] = useState<User | null>(null);
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [duration, setDuration] = useState("");
  const [language, setLanguage] = useState("es");
  const [structure, setStructure] = useState("");
  const [addCTA, setAddCTA] = useState(false);
  const [ctaText, setCtaText] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (currentUser) =>
      setUser(currentUser)
    );
    return () => unsub();
  }, []);

  const handleGenerate = async () => {
    if (!description || !tone || !platform || !duration || !structure) {
      toast.error("Por favor, completa todos los campos obligatorios.");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión para crear guiones.");
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

      const scriptId = uuidv4();
      await setDoc(doc(db, "users", user.uid, "guiones", scriptId), {
        description,
        tone,
        platform,
        duration,
        language,
        structure,
        addCTA,
        ctaText,
        script: data.script || "",
        createdAt: serverTimestamp(),
        scriptId,
        regenerations: 0,
        isAI: true,
      });

      toast.success("Guion generado correctamente");
      router.push("/dashboard/script");
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("No se pudo generar el guion.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
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
      onSubmit={handleGenerate}
    />
  );
}
