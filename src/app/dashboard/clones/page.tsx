"use client";

import { useUserPanel } from "@/components/user/useUserPanel";
import ClonacionVideosSection from "@/components/user/ClonacionVideosSection";
import VoicesListContainer from "@/components/voice/VoicesListContainer";

export default function UserPage() {
  const {
    t,
    clonacionVideos,
    handleUpload,
    handleDelete, // este requiere id + storagePath
    uploading,
    progress,
  } = useUserPanel();

  return (
    <div className="space-y-8">
      <ClonacionVideosSection
        t={t}
        clonacionVideos={clonacionVideos}
        handleUpload={handleUpload}
        // 👇 aquí el wrapper
        handleDelete={(id) => {
          const video = clonacionVideos.find((v) => v.id === id);
          return handleDelete(id, (video as any)?.storagePath ?? "");
        }}
        uploading={uploading}
        progress={progress}
      />

      <VoicesListContainer variant="card" title="🎤 Voces de clonación" />
    </div>
  );
}
