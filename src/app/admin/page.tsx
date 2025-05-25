"use client";
import { uploadFile } from "@/lib/uploadToStorage";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Order = {
  id: string;
  title: string;
  format: string;
  status: string;
  userId: string;
  deliveredUrl?: string;
};

const estados = ["pendiente", "en_producción", "entregado"];

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = async () => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Order[];
    setOrders(data);
  };

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, "orders", id), { status });
    fetchOrders();
  };

  const updateUrl = async (id: string, url: string) => {
    await updateDoc(doc(db, "orders", id), { deliveredUrl: url });
    fetchOrders();
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Panel Admin – Pedidos</h1>
      {orders.map((order) => (
        <Card key={order.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold">{order.title}</h2>
                <p className="text-sm text-muted-foreground">{order.userId}</p>
              </div>
              <Badge>{order.format}</Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">Estado:</span>
              {estados.map((estado) => (
                <Button
                  key={estado}
                  size="sm"
                  variant={order.status === estado ? "default" : "outline"}
                  onClick={() => updateStatus(order.id, estado)}
                >
                  {estado}
                </Button>
              ))}
            </div>

            <div className="flex flex-col gap-1">
            <Label>Entrega (URL manual o archivo):</Label>
            <Input
                placeholder="https://..."
                defaultValue={order.deliveredUrl}
                onBlur={(e) => updateUrl(order.id, e.target.value)}
            />
            <Input
                type="file"
                onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const url = await uploadFile(file, `deliveries/${order.id}/${file.name}`);
                await updateUrl(order.id, url);
                }}
            />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
