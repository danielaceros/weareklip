"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import TaskInbox from "@/components/shared/taskinbox";
import TaskModal from "@/components/shared/taskmodal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export default function AdminTasksPage() {
  const t = useT();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // 🔍 Busca el doc de admin por email (normalizado)
  const getUidFromEmail = useCallback(async (email: string): Promise<string | null> => {
    try {
      const emailNorm = email.trim().toLowerCase();
      const q = query(collection(db, "admin"), where("email", "==", emailNorm), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return snap.docs[0].id;
    } catch (err) {
      console.error("[AdminTasks] Error reading admin doc:", err);
      toast.error(t("admin.tasks.errors.loadAdminDoc"));
      return null;
    }
  }, [t]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        setAdminId(null);
        setLoading(false);
        return;
      }
      const id = await getUidFromEmail(user.email);
      if (!id) {
        toast.error(t("admin.tasks.errors.noAdminDoc"));
      }
      setAdminId(id);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [getUidFromEmail, t]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-40" aria-label={t("admin.tasks.loading.title")} />
        <Skeleton className="h-32 w-full" aria-label={t("admin.tasks.loading.list")} />
      </div>
    );
  }

  if (!adminId) {
    return <div className="p-6 text-red-500">{t("admin.tasks.mustBeAdmin")}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">📋 {t("admin.tasks.title")}</h1>
        <Button onClick={() => setModalOpen(true)}>{t("admin.tasks.newTask")}</Button>
      </div>

      <TaskInbox adminId={adminId} />

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        adminId={adminId}
        task={null} // Nueva tarea
      />
    </div>
  );
}
