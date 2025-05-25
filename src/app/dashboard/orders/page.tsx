"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// Elimina la importación de 'Link' si no se usa
// import Link from "next/link"; // <--- Eliminar esta línea

type Order = {
  id: string;
  title: string;
  format: string;
  status: string;
  createdAt?: { seconds: number; nanoseconds: number };
  deliveredUrl?: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "orders"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[];

      setOrders(docs);
    };

    fetchOrders();
  }, []);

  if (!orders) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (orders.length === 0) {
    return <p className="text-muted-foreground">Aún no has creado ningún pedido.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mis pedidos</h1>
      {orders.map((order) => (
        <Card key={order.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">{order.title}</h2>
              <Badge variant="outline">{order.format}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Estado:{" "}
                <Badge
                  variant={
                    order.status === "entregado"
                      ? "default"
                      : order.status === "en_producción"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {order.status}
                </Badge>
              </p>
              {order.deliveredUrl ? (
                <a
                  href={order.deliveredUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="secondary">
                    Ver entrega
                  </Button>
                </a>
              ) : (
                <Badge variant="outline">Aún no entregado</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
