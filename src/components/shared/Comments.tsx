"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import type { ReelComment } from "@/types/video";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";

type Props = {
  /** Ruta al doc (p.ej. `users/{uid}/videos/{videoId}`) */
  docPath: string;
};

export default function Comments({ docPath }: Props) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [text, setText] = useState("");
  const user = auth.currentUser;

  const docRef = useMemo(() => doc(db, docPath), [docPath]);

  useEffect(() => {
    // Carga inicial y realtime
    const unsub = onSnapshot(docRef, (snap) => {
      const data = snap.data() as { comments?: ReelComment[] } | undefined;
      setComments(
        Array.isArray(data?.comments)
          ? [...data!.comments].sort((a, b) => a.createdAt - b.createdAt)
          : []
      );
    });

    // Asegura que existe el doc (si fuera necesario)
    (async () => {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        // No creamos doc aquí para no interferir; el vídeo ya debe existir
      }
    })();

    return () => unsub();
  }, [docRef]);

  const addComment = async () => {
    if (!user) {
      toast.error("Debes iniciar sesión para comentar.");
      return;
    }
    const content = text.trim();
    if (!content) return;

    const newComment: ReelComment = {
      id: crypto.randomUUID(),
      uid: user.uid,
      name: user.displayName || user.email || "Usuario",
      text: content,
      createdAt: Date.now(),
    };

    try {
      await updateDoc(docRef, {
        comments: arrayUnion(newComment),
        // opcional: touchedAt para ordenación externa
        touchedAt: Timestamp.now(),
      });
      setText("");
    } catch (e) {
      toast.error("No se pudo guardar el comentario");
      console.error(e);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un comentario…"
          rows={3}
        />
        <div className="flex justify-end">
          <Button onClick={addComment} disabled={!text.trim()}>
            Añadir comentario
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-xs text-foreground/60">Aún no hay comentarios.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                {getInitials(c.name)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-foreground/70">
                  <span className="font-medium">{c.name}</span>
                  <span>•</span>
                  <time dateTime={new Date(c.createdAt).toISOString()}>
                    {formatTimeAgo(c.createdAt)}
                  </time>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatTimeAgo(ms: number) {
  const diff = Date.now() - ms;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "justo ahora";
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.round(hr / 24);
  return `hace ${d} d`;
}

