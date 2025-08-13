"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { VoiceCard } from "./VoiceCard";
import Link from "next/link";

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

export default function VoicesListContainer() {
  const [user, setUser] = useState<User | null>(null);
  const [voices, setVoices] = useState<(VoiceData & VoiceMeta)[]>([]);
  const [loading, setLoading] = useState(true);

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

      const voicesWithMeta: (VoiceData & VoiceMeta)[] = await Promise.all(
        rawVoices.map(async (voice) => {
          try {
            const res = await fetch(`/api/elevenlabs/voice/get?voiceId=${voice.voiceId}`);
            if (!res.ok) throw new Error("No se pudo obtener metadata");
            const data = await res.json();
            return {
              ...voice,
              preview_url: data.preview_url,
              description: data.description,
              category: data.category,
            };
          } catch {
            return voice;
          }
        })
      );

      setVoices(voicesWithMeta);
    } catch (err) {
      console.error("Error fetching voices:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  if (loading) return <p>Cargando voces...</p>;

  return (
    <div className="relative">
      {/* Botón arriba a la derecha */}
      <div className="absolute right-0 -top-2 mb-4">
        <Link href="/dashboard/voice/new">
          <Button className="bg-blue-500 hover:bg-blue-600 text-white">
            + Nueva voz
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-10">
        {voices.length === 0 && <p>No tienes voces aún.</p>}
        {voices.map((voice) => (
          <VoiceCard key={voice.voiceId} {...voice} />
        ))}
      </div>
    </div>
  );
}
