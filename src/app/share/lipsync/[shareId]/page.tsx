import { notFound } from "next/navigation";
import { adminDB } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic"; // sin cache SSR para previews

type LipsyncDoc = {
  title?: string;
  downloadUrl?: string;
  status?: string; // "completed", "processing", etc.
  thumbnail?: string;
  createdAt?: any;
  public?: boolean;
  uid_share?: string;
};

async function resolveSharedLipsync(shareId: string) {
  // 1) Buscar el mapeo global (igual que en scripts)
  const shareSnap = await adminDB.doc(`shares/${shareId}`).get();
  if (!shareSnap.exists) return null;

  const share = shareSnap.data() as any;
  // Esperamos: { public: true, kind: "lipsync", path: "users/<uid>/lipsync/<id>" }
  if (!share?.public || share?.kind !== "lipsync" || !share?.path) return null;

  // 2) Leer el doc real por path (sin índices)
  const snap = await adminDB.doc(String(share.path)).get();
  if (!snap.exists) return null;

  const data = snap.data() as LipsyncDoc;

  // 3) Guardia extra: debe seguir público
  if (!data.public) return null;

  return { id: snap.id, ...data };
}

export default async function PublicLipsyncPage({
  params,
}: {
  params: { shareId: string };
}) {
  const doc = await resolveSharedLipsync(params.shareId);
  if (!doc) return notFound();

  // Si no hay URL de vídeo, no tiene sentido renderizar reproductor
  const cannotPlay = !doc.downloadUrl || doc.status === "processing";

  return (
    <main className="min-h-dvh bg-black text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-[420px] rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="mb-3">
          <h1 className="text-lg font-semibold">Reel compartido</h1>
          <p className="text-xs text-neutral-400">
            Vista pública (solo lectura) — Reel generado por KLIP
          </p>
        </div>

        <div className="relative rounded-xl overflow-hidden border border-neutral-800 bg-black aspect-[9/16]">
          {cannotPlay ? (
            <div className="w-full h-full grid place-items-center text-neutral-400 text-sm">
              Este vídeo no está disponible todavía.
            </div>
          ) : (
            <video
              controls
              playsInline
              src={doc.downloadUrl}
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />
          )}

          {/* Marca de agua */}
          <div className="absolute bottom-2 right-2 text-[10px] px-2 py-1 bg-white/10 backdrop-blur rounded">
            Reel generado por KLIP
          </div>
        </div>

        {doc.title && (
          <h2 className="mt-3 text-base font-medium truncate">{doc.title}</h2>
        )}
      </div>
    </main>
  );
}
