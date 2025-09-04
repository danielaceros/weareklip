"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";

interface ChatbotPanelProps {
  onClose: () => void;
}

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Timestamp;
};

const MAX_CHARS = 300;
const MAX_REQUESTS = 20;

export default function ChatbotPanel({ onClose }: ChatbotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestsCount, setRequestsCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { ensureSubscribed } = useSubscriptionGate();
  const [showCheckout, setShowCheckout] = useState(false);

  // nuevos modales
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLimitReached, setShowLimitReached] = useState(false);

  // 🔹 Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🔹 Polling histórico
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const sessionId = "default";

    const fetchMessages = async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(
          `/api/firebase/users/${user.uid}/sessions/${sessionId}/messages`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );

        if (!res.ok) throw new Error("Error al cargar mensajes");

        const data: ChatMessage[] = await res.json();

        data.sort((a, b) => {
          const tA =
            a.createdAt instanceof Date
              ? a.createdAt.getTime()
              : (a.createdAt as any)?.toMillis?.() ?? 0;
          const tB =
            b.createdAt instanceof Date
              ? b.createdAt.getTime()
              : (b.createdAt as any)?.toMillis?.() ?? 0;
          return tA - tB;
        });

        setMessages(data);
        setRequestsCount(data.filter((m) => m.role === "user").length);
      } catch (err) {
        console.error("❌ Error cargando mensajes:", err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    if (requestsCount >= MAX_REQUESTS) {
      setShowLimitReached(true);
      return;
    }

    setLoading(true);
    const userMessage = input.slice(0, MAX_CHARS);
    setInput("");

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: userMessage },
      { id: `${tempId}-assistant`, role: "assistant", content: "..." },
    ]);
    setRequestsCount((c) => c + 1);

    const ok = await ensureSubscribed({ feature: "chatbot" });
    if (!ok) {
      setShowCheckout(true);
      setLoading(false);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const sessionId = "default";
    const messagesRef = collection(
      db,
      `users/${user.uid}/sessions/${sessionId}/messages`
    );

    addDoc(messagesRef, {
      role: "user",
      content: userMessage,
      createdAt: serverTimestamp(),
    }).catch((err) => console.error("❌ Error guardando user msg:", err));

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/chatgpt/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
        }),
      });

      const data = await res.json();
      const assistantMsg = data.content ?? "⚠️ Error en la respuesta";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === `${tempId}-assistant` ? { ...m, content: assistantMsg } : m
        )
      );

      await addDoc(messagesRef, {
        role: "assistant",
        content: assistantMsg,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === `${tempId}-assistant`
            ? { ...m, content: "⚠️ Error al contactar al asistente." }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const sessionId = "default";
    const messagesRef = collection(
      db,
      `users/${user.uid}/sessions/${sessionId}/messages`
    );

    try {
      const snapshot = await getDocs(messagesRef);
      await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
      setMessages([]);
      setRequestsCount(0);
    } catch (err) {
      console.error("❌ Error al borrar historial:", err);
    } finally {
      setShowClearConfirm(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <div
        className="
          fixed right-0 md:right-6 bottom-0 md:bottom-20
          w-full md:w-80
          h-[60vh] md:h-96
          bg-background text-foreground shadow-xl rounded-t-2xl md:rounded-2xl
          flex flex-col border overflow-hidden z-50
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
          <h2 className="font-semibold text-sm">Asistente 🤖</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-muted-foreground hover:text-destructive transition"
              title="Borrar historial"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <ScrollArea className="flex-1 h-full overflow-y-auto">
          <div className="px-3 py-2 space-y-2 text-sm">
            {messages.map((m, i) => (
              <div
                key={m.id ?? i}
                className={`p-2 rounded-lg max-w-[80%] ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted text-foreground/80 mr-auto"
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <p className="text-xs text-muted-foreground italic">
                Escribiendo...
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t flex gap-2 bg-background">
          <Input
            value={input}
            maxLength={MAX_CHARS}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Escribe tu mensaje (máx. ${MAX_CHARS} caracteres)...`}
            className="text-sm"
            disabled={loading || requestsCount >= MAX_REQUESTS}
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={loading || requestsCount >= MAX_REQUESTS}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
          </Button>
        </div>
      </div>

      {/* Modal checkout */}
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Para usar el asistente necesitas suscripción activa, empieza tu prueba GRATUITA de 7 días"
      />

      {/* Modal borrar historial */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Borrar historial?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción eliminará todos los mensajes de esta sesión. No se puede
            deshacer.
          </p>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={clearHistory}>
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal límite alcanzado */}
      <Dialog open={showLimitReached} onOpenChange={setShowLimitReached}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Límite alcanzado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Has llegado al límite de {MAX_REQUESTS} mensajes en esta sesión.
          </p>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setShowLimitReached(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
