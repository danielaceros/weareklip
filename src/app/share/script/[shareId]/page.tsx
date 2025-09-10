// src/app/share/script/[shareId]/page.tsx
import { notFound } from "next/navigation";
import { adminDB } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic"; // sin cache SSR para previews

type ScriptDoc = {
  description?: string;
  script?: string;
  platform?: string;
  language?: string;
  videoTitle?: string;
  videoDescription?: string;
  videoThumbnail?: string;
  createdAt?: any;
  public?: boolean;
  uid_share?: string;
};

async function resolveSharedScript(shareId: string) {
  // 1) Buscar el mapeo global
  const shareSnap = await adminDB.doc(`shares/${shareId}`).get();
  if (!shareSnap.exists) return null;

  const share = shareSnap.data() as any;
  if (!share?.public || share?.kind !== "script" || !share?.path) return null;

  // 2) Leer el doc real
  const snap = await adminDB.doc(share.path as string).get();
  if (!snap.exists) return null;

  const data = snap.data() as ScriptDoc;

  // Seguridad extra: debe seguir público
  if (!data.public) return null;

  return { id: snap.id, ...data };
}

export default async function PublicScriptPage(props: any) {
  const shareId = props?.params?.shareId as string | undefined;
  if (!shareId) return notFound();

  const doc = await resolveSharedScript(shareId);
  if (!doc) return notFound();

  return (
    <main className="min-h-dvh bg-black text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Guion compartido</h1>
          <p className="text-sm text-neutral-400">
            Vista pública (solo lectura) — Reel generado por KLIP
          </p>
        </div>

        {doc.videoThumbnail ? (
          <img
            src={doc.videoThumbnail}
            alt="Miniatura"
            className="rounded-lg border border-neutral-800 mb-4 w-full object-cover"
          />
        ) : null}

        {doc.description && (
          <h2 className="text-lg font-medium mb-2">{doc.description}</h2>
        )}

        <article className="whitespace-pre-wrap leading-relaxed text-neutral-200">
          {doc.script || doc.videoDescription || "Sin contenido"}
        </article>

        <div className="mt-6 text-xs text-neutral-500">
          Compartido desde KLIP — {doc.platform || "general"} ·{" "}
          {doc.language || "es"}
        </div>
      </div>
    </main>
  );
}
