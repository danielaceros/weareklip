"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ChatbotPanelProps {
  onClose: () => void;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
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

  // 🔹 Cargar histórico en tiempo real
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const sessionId = "default";
    const messagesRef = collection(
      db,
      `users/${user.uid}/chatSessions/${sessionId}/messages`
    );

    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: ChatMessage[] = snap.docs.map(
        (doc) => doc.data() as ChatMessage
      );
      setMessages(loaded);
    });

    return () => unsub();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const user = auth.currentUser;
    if (!user) return alert("Debes iniciar sesión");

    const sessionId = "default";
    const messagesRef = collection(
      db,
      `users/${user.uid}/chatSessions/${sessionId}/messages`
    );

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

      const data = await res.json();
      await addDoc(messagesRef, {
        role: "assistant",
        content: data.reply,
        createdAt: serverTimestamp(),
      });
    } catch {
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
    <div className="fixed bottom-20 right-6 w-80 h-96 bg-background text-foreground shadow-xl rounded-2xl flex flex-col border overflow-hidden">
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
          {messages.map((m, i) => (
            <div
              key={i}
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
            <p className="text-xs text-muted-foreground italic">Escribiendo...</p>
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
