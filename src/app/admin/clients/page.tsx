"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import ClienteList from "@/components/shared/clientlist";
import ClienteSkeletonGrid from "@/components/shared/clientskeleton";
import { useT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type ClienteActivo = {
  uid: string;
  email: string;
  name?: string;
  planName?: string;
  createdAt?: number;
  subStatus?: string;
  lang?: Locale;
};

type StripeCliente = {
  email: string;
  planName?: string;
  createdAt?: number;
  subStatus?: string;
};

type FirestoreUserDoc = {
  email?: string;
  name?: string;
  createdAt?: number;
  lang?: Locale;
  settings?: { lang?: Locale };
};

export default function ClientListPage() {
  const t = useT();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [clientes, setClientes] = useState<ClienteActivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastId, setLastId] = useState<string | null>(null);

  const normalize = (str: string) => (str ? str.trim().toLowerCase() : "");

  const fetchFirestoreUsers = useCallback(
    async (): Promise<Record<string, Partial<ClienteActivo>>> => {
      const snapshot = await getDocs(collection(db, "users"));
      const result: Record<string, Partial<ClienteActivo>> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreUserDoc;
        if (data.email) {
          result[normalize(data.email)] = {
            uid: docSnap.id,
            name: data.name,
            createdAt: data.createdAt,
            lang: data.settings?.lang ?? data.lang,
          };
        }
      });
      return result;
    },
    []
  );

  const fetchActivos = useCallback(
    async (startingAfter: string | null = null) => {
      try {
        if (startingAfter) setLoadingMore(true);
        else setLoading(true);

        const res = await fetch(
          `/api/stripe/customers${startingAfter ? `?starting_after=${startingAfter}` : ""}`
        );
        const json = await res.json();
        if (!json?.data) throw new Error("INVALID_RESPONSE");

        const { data, hasMore: more, lastId: newLastId } = json as {
          data: StripeCliente[];
          hasMore: boolean;
          lastId: string | null;
        };

        const firestoreMap = await fetchFirestoreUsers();

        const nuevosClientes: ClienteActivo[] = data
          .filter((c) => !!c.email)
          .map((c) => {
            const key = normalize(c.email);
            const match = firestoreMap[key] || {};
            return {
              uid: (match.uid as string) || c.email,
              email: c.email,
              name: (match.name as string) || "",
              planName: c.planName,
              createdAt: c.createdAt,
              subStatus: c.subStatus,
              lang: match.lang as Locale | undefined,
            };
          });

        setClientes((prev) => {
          const seen = new Set(prev.map((c) => c.uid));
          const nuevosUnicos = nuevosClientes.filter((c) => !seen.has(c.uid));
          return [...prev, ...nuevosUnicos];
        });

        setHasMore(more);
        setLastId(newLastId);
      } catch (err) {
        console.error("Error al cargar clientes:", err);
        toast.error(tRef.current("admin.common.loadError") || "Error al cargar clientes");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [fetchFirestoreUsers]
  );

  // 🔒 Guard contra el doble-mount de StrictMode en dev
  const fetchedOnce = useRef(false);
  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    fetchActivos();
  }, [fetchActivos]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">👥 {t("sidebar.clients")}</h1>

      {loading ? (
        <ClienteSkeletonGrid />
      ) : (
        <>
          <ClienteList clientes={clientes} />
          {hasMore && (
            <div className="text-center mt-6">
              <Button onClick={() => fetchActivos(lastId)} disabled={loadingMore}>
                {loadingMore ? t("admin.clients.table.loading") : t("admin.clients.table.loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
