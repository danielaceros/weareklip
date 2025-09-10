// src/app/share/lipsync/[shareId]/page.tsx
import { notFound } from "next/navigation";
import { adminDB } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type LipsyncDoc = {
  title?: string;
  description?: string;
  public?: boolean;
  uid_share?: string;
  url?: string;
  videoUrl?: string;
  fileUrl?: string;
  downloadUrl?: string;
  thumb?: string;
  thumbnail?: string;
  videoThumbnail?: string;
};

function pickUrl(d: LipsyncDoc) {
  return d.url || d.videoUrl || d.fileUrl || d.downloadUrl || "";
}

function pickThumb(d: LipsyncDoc) {
  return d.thumbnail || d.videoThumbnail || d.thumb || "";
}

async function resolveSharedLipsync(shareId: string) {
  // 1) Mapa global
  const shareSnap = await adminDB.doc(`shares/${shareId}`).get();
  if (!shareSnap.exists) return null;
  const share = shareSnap.data() as any;
  if (!share?.public || share?.kind !== "lipsync" || !share?.path) return null;

  // 2) Doc real
  const snap = await adminDB.doc(share.path as string).get();
  if (!snap.exists) return null;

  const data = snap.data() as LipsyncDoc;
  if (!data.public) return null;

  return { id: snap.id, ...data };
}

export default async function PublicLipsyncPage(props: any) {
  const shareId = props?.params?.shareId as string | undefined;
  if (!shareId) return notFound();

  const doc = await resolveSharedLipsync(shareId);
  if (!doc) return notFound();

  const src = pickUrl(doc);
  const thumb = pickThumb(doc);

  return (
    <main className="min-h-dvh bg-black text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">
            {doc.title || "Lipsync compartido"}
          </h1>
        </div>

        {/* Player compacto, sin recortes, 9:16 */}
        <div className="relative mx-auto w-full max-w-[420px] md:max-w-[480px] aspect-[9/16] rounded-xl overflow-hidden border border-neutral-800 bg-black">
          <video
            controls
            playsInline
            preload="metadata"
            poster={thumb || undefined}
            className="w-full h-full object-contain"
            src={src}
          />
          <div className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-white/60 bg-black/30 px-2 py-1 rounded">
            KLIP • preview
          </div>
        </div>

        {doc.description && (
          <p className="mt-4 text-sm text-neutral-300 whitespace-pre-wrap">
            {doc.description}
          </p>
        )}
      </div>
    </main>
  );
}
