// src/components/shared/clientdatosform.tsx
"use client";

import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Phone, Folder, User } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type Cliente = {
  email: string;
  name?: string;
  phone?: string;
  instagramUser?: string;
  notas?: string;
  carpetaTrabajo?: string;
};

type Props = {
  cliente: Cliente;
  setCliente: React.Dispatch<React.SetStateAction<Cliente | null>>;
  uid: string;
  onSave: () => Promise<void>;
};

export default function ClienteDatosForm({
  cliente,
  setCliente,
  onSave,
}: Props) {
  const t = useTranslations("clientForm");
  if (!cliente) return null;

  const copiarEmail = async () => {
    try {
      await navigator.clipboard.writeText(cliente.email);
      toast.success(t("emailCopied"));
    } catch {
      toast.error(t("copyError"));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">📝 {t("title")}</h2>

      {/* Email */}
      <div>
        <div className="flex items-center gap-2">
          <Image
            src="/gmail-icon-bw.svg"
            alt="Gmail logo"
            width={24}
            height={24}
            className="rounded object-contain"
          />
          <Input
            value={cliente.email}
            readOnly
            type="email"
            aria-label="Email"
            className="bg-muted cursor-not-allowed"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={copiarEmail}
            title={t("copyEmail")}
            aria-label={t("copyEmail")}
          >
            <Copy size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Nombre */}
      <div className="flex items-center gap-2">
        <User size={20} aria-hidden="true" />
        <Input
          placeholder={t("placeholders.name")}
          aria-label={t("labels.name")}
          value={cliente.name || ""}
          onChange={(e) =>
            setCliente((prev) =>
              prev ? { ...prev, name: e.target.value } : prev
            )
          }
        />
      </div>

      {/* Teléfono */}
      <div className="flex items-center gap-2">
        <Phone size={20} aria-hidden="true" />
        <Input
          placeholder={t("placeholders.phone")}
          aria-label={t("labels.phone")}
          value={cliente.phone || ""}
          onChange={(e) =>
            setCliente((prev) =>
              prev ? { ...prev, phone: e.target.value } : prev
            )
          }
        />
      </div>

      {/* Instagram */}
      <div className="flex items-center gap-2">
        <Image
          src="/instagram-icon.svg"
          alt="Instagram logo"
          width={20}
          height={20}
          className="rounded-full object-cover"
        />
        <Input
          placeholder={t("placeholders.instagram")}
          aria-label={t("labels.instagram")}
          value={cliente.instagramUser || ""}
          onChange={(e) =>
            setCliente((prev) =>
              prev ? { ...prev, instagramUser: e.target.value } : prev
            )
          }
        />
      </div>

      {/* Carpeta de trabajo */}
      <div className="flex items-center gap-2">
        <Folder size={20} aria-hidden="true" />
        <Input
          placeholder={t("placeholders.workFolder")}
          aria-label={t("labels.workFolder")}
          type="url"
          value={cliente.carpetaTrabajo || ""}
          onChange={(e) =>
            setCliente((prev) =>
              prev ? { ...prev, carpetaTrabajo: e.target.value } : prev
            )
          }
        />
      </div>

      {/* Notas internas */}
      <Textarea
        placeholder={t("notesPlaceholder")}
        aria-label={t("notesPlaceholder")}
        value={cliente.notas || ""}
        onChange={(e) =>
          setCliente((prev) =>
            prev ? { ...prev, notas: e.target.value } : prev
          )
        }
      />

      <Button type="button" onClick={onSave} className="w-full">
        {t("save")}
      </Button>
    </div>
  );
}
