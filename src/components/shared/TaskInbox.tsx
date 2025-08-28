"use client";

import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import TaskList from "@/components/shared/TaskList";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { getAuth } from "firebase/auth";

type Task = {
  id: string;
  descripcion: string;
  estado: "Nuevo" | "Hecho"; // ⚠️ Mantenemos estos valores tal cual para no romper Firestore
  creadoEn: number;
  fechaFin?: number;
};

type Props = {
  adminId: string;
};

export default function TaskInbox({ adminId }: Props) {
  const t = useT();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!adminId) return;

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No autenticado");
      const idToken = await currentUser.getIdToken();

      const res = await fetch(`/api/firebase/admin/${adminId}/tasks`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) throw new Error("Error en el servidor");

      const data: Task[] = await res.json();

      setTasks(data.sort((a, b) => (b.creadoEn ?? 0) - (a.creadoEn ?? 0)));
    } catch (err) {
      console.error("Error fetching tasks:", err);
      toast.error(t("admin.tasks.toasts.loadError"));
    }
  }, [adminId, t]);

  const handleEdit = (task: Task) => setEditingTask(task);
  // ✅ Alternar estado de una tarea
  const toggleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newEstado: Task["estado"] = task.estado === "Hecho" ? "Nuevo" : "Hecho";
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No autenticado");

      const res = await fetch(`/api/firebase/admin/${adminId}/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ estado: newEstado }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, estado: newEstado } : t))
      );
    } catch (err) {
      console.error("❌ Error toggleTask:", err);
      toast.error(t("admin.tasks.toasts.toggleError"));
    }
  };

  // ✅ Editar tarea
  const saveEditedTask = async () => {
    if (!editingTask) return;
    try {
      const { id, descripcion, fechaFin } = editingTask;
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No autenticado");

      const res = await fetch(`/api/firebase/admin/${adminId}/tasks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ descripcion, fechaFin }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, descripcion, fechaFin } : t))
      );

      toast.success(t("admin.tasks.toasts.saved"));
      setEditingTask(null);
    } catch (err) {
      console.error("❌ Error saveEditedTask:", err);
      toast.error(t("admin.tasks.toasts.saveError"));
    }
  };

  // ✅ Eliminar tarea
  const handleDelete = async (taskId: string) => {
    if (!confirm(t("admin.tasks.toasts.deleteConfirm"))) return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No autenticado");

      const res = await fetch(`/api/firebase/admin/${adminId}/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success(t("admin.tasks.toasts.deleted"));
    } catch (err) {
      console.error("❌ Error handleDelete:", err);
      toast.error(t("admin.tasks.toasts.deleteError"));
    }
  };


  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-xl font-bold">📥 {t("admin.tasks.inboxTitle")}</h2>

          <TaskList
            tasks={tasks.filter((t) => t.estado === "Nuevo")}
            onToggleDone={toggleTask}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          <details className="mt-4">
            <summary className="text-sm text-gray-500 cursor-pointer hover:underline">
              {t("admin.tasks.showCompleted")}
            </summary>
            <TaskList
              tasks={tasks.filter((t) => t.estado === "Hecho")}
              onToggleDone={toggleTask}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </details>
        </CardContent>
      </Card>

      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {t("admin.tasks.dialog.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder={t("admin.tasks.dialog.descriptionPlaceholder")}
              value={editingTask?.descripcion ?? ""}
              onChange={(e) =>
                setEditingTask((prev) => (prev ? { ...prev, descripcion: e.target.value } : null))
              }
            />

            <Input
              aria-label={t("admin.tasks.dialog.dueDate")}
              type="date"
              value={
                editingTask?.fechaFin
                  ? new Date(editingTask.fechaFin).toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) =>
                setEditingTask((prev) =>
                  prev ? { ...prev, fechaFin: new Date(e.target.value).getTime() } : null
                )
              }
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingTask(null)}>
                {t("admin.tasks.dialog.cancel")}
              </Button>
              <Button onClick={saveEditedTask}>{t("admin.tasks.dialog.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
