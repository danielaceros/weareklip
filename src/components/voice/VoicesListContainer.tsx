// src/components/voice/VoicesListContainer.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { VoiceCard } from "./VoiceCard";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import NewVoiceContainer from "./NewVoiceContainer";

interface VoiceData {
  voiceId: string;
  name: string;
  createdAt?: { seconds: number; nanoseconds: number };
}

interface VoiceMeta {
  preview_url?: string;
  description?: string;
  category?: string;
}

interface Props {
  variant?: "default" | "card"; // 👈 aquí añadimos
  title?: string;               // 👈 y aquí
}

export default function VoicesListContainer({
  variant = "default",
  title = "Voces",
}: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [voices, setVoices] = useState<(VoiceData & VoiceMeta)[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  const fetchVoices = useCallback(async () => {
    if (!user) return;
    try {
      const ref = collection(db, "users", user.uid, "voices");
      const snapshot = await getDocs(ref);
      const rawVoices: VoiceData[] = snapshot.docs.map((doc) => ({
        voiceId: doc.id,
        ...(doc.data() as Omit<VoiceData, "voiceId">),
      }));

      setVoices(rawVoices);
    } catch (err) {
      console.error("Error fetching voices:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  return (
    <section
      className={`${
        variant === "card"
          ? "border border-border rounded-lg p-6 bg-card text-card-foreground shadow-sm"
          : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Button onClick={() => setOpen(true)}>+ Nueva voz</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando voces...</p>
      ) : voices.length === 0 ? (
        <p className="text-muted-foreground">No tienes voces aún.</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {voices.map((voice) => (
            <VoiceCard key={voice.voiceId} {...voice} />
          ))}
        </div>
      )}

      {/* Modal Crear Voz */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <NewVoiceContainer />
        </DialogContent>
      </Dialog>
    </section>
  );
}
