"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatbotPanelProps {
  onClose: () => void;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt?: Timestamp;
};

export default function ChatbotPanel({ onClose }: ChatbotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 🔹 Auto scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🔹 Cargar histórico en tiempo real (con polling)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const sessionId = "default";

    const fetchMessages = async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(
          `/api/firebase/users/${user.uid}/sessions/${sessionId}/messages`,
          {
            headers: { Authorization: `Bearer ${idToken}` },
          }
        );

        if (!res.ok) throw new Error("Error al cargar mensajes");

        const data: ChatMessage[] = await res.json();

        // 🔄 Ordenamos por fecha (si no lo hace tu API)
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
      } catch (err) {
        console.error("❌ Error cargando mensajes:", err);
      }
    };

    // 1. Cargar mensajes al montar
    fetchMessages();

    // 2. Polling cada 5s
    const interval = setInterval(fetchMessages, 5000);

    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const user = auth.currentUser;
    if (!user) return alert("Debes iniciar sesión");

    const sessionId = "default";
    const messagesRef = collection(
      db,
      `users/${user.uid}/sessions/${sessionId}/messages`
    );

    // Guardamos el mensaje del usuario
    await addDoc(messagesRef, {
      role: "user",
      content: input,
      createdAt: serverTimestamp(),
    });

    const newMessages = [...messages, { role: "user", content: input }];
    setInput("");
    setLoading(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/chatgpt/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";

      // 🔹 Creamos doc vacío para ir actualizando en Firestore
      const docRef = await addDoc(messagesRef, {
        role: "assistant",
        content: "",
        createdAt: serverTimestamp(),
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantMsg += decoder.decode(value, { stream: true });

        // 🔹 Actualizamos SIEMPRE el mismo doc
        await updateDoc(docRef, {
          content: assistantMsg,
        });
      }
    } catch (err) {
      console.error(err);
      await addDoc(messagesRef, {
        role: "assistant",
        content: "⚠️ Error al contactar al asistente.",
        createdAt: serverTimestamp(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
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
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Área scrollable */}
      <ScrollArea className="flex-1 h-full overflow-y-auto">
        <div className="px-3 py-2 space-y-2 text-sm">
          {messages.map((m, i) => {
            const isLastAssistant =
              i === messages.length - 1 && m.role === "assistant";

            return (
              <div
                key={i}
                className={`p-2 rounded-lg max-w-[80%] ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted text-foreground/80 mr-auto"
                }`}
              >
                {m.content}
                {isLastAssistant && loading && (
                  <span className="ml-1 animate-pulse">▋</span>
                )}
              </div>
            );
          })}
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
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Escribe tu mensaje..."
          className="text-sm"
        />
        <Button size="sm" onClick={sendMessage} disabled={loading}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
