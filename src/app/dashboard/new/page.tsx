"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

const formatOptions = ["Reel", "TikTok", "YouTube", "Otro"] as const;
type FormatType = (typeof formatOptions)[number];

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  audience: z.string().min(3),
  format: z.enum(formatOptions),
});

export default function NewOrderPage() {
  const router = useRouter();
  type FormData = z.infer<typeof schema>;
    const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
        title: "",
        description: "",
        audience: "",
        format: "Reel",
    },
    });

  const onSubmit = async (data: any) => {
    const user = auth.currentUser;
    if (!user) return alert("Usuario no autenticado");

    try {
      await addDoc(collection(db, "orders"), {
        ...data,
        userId: user.uid,
        status: "pendiente",
        createdAt: serverTimestamp(),
      });
      router.push("/dashboard/orders");
    } catch (err) {
      alert("Error al crear pedido");
      console.error(err);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Nuevo pedido</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label>Título del pedido</Label>
          <Input {...register("title")} />
          {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
        </div>

        <div>
          <Label>Descripción / Objetivo</Label>
          <Textarea rows={4} {...register("description")} />
          {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
        </div>

        <div>
          <Label>Público objetivo</Label>
          <Input {...register("audience")} />
          {errors.audience && <p className="text-sm text-red-500">{errors.audience.message}</p>}
        </div>

        <div>
          <Label>Formato</Label>
            <Select
            onValueChange={(value: FormatType) => setValue("format", value)}
            defaultValue="Reel"
            >
            <SelectTrigger>
                <SelectValue placeholder="Selecciona un formato" />
            </SelectTrigger>
            <SelectContent>
                {formatOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                    {opt}
                </SelectItem>
                ))}
            </SelectContent>
            </Select>

          {errors.format && <p className="text-sm text-red-500">{errors.format.message}</p>}
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enviando..." : "Enviar pedido"}
        </Button>
      </form>
    </div>
  );
}
