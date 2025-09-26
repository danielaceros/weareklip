// src/app/dashboard/user/page.tsx (o ruta equivalente)
"use client";

import { useUserPanel } from "@/components/user/useUserPanel";
import ClonacionVideosSection from "@/components/user/ClonacionVideosSection";
import VoicesListContainer from "@/components/voice/VoicesListContainer";

export default function UserPage() {
  const {
    t,
    clonacionVideos,
    handleUpload,
    handleDelete, // requiere id + storagePath
    uploading,
    progress,
  } = useUserPanel();

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-8">
      {/* Layout responsive: columnas en desktop, stack en móvil */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Videos */}
        <ClonacionVideosSection
          t={t}
          clonacionVideos={clonacionVideos}
          handleUpload={handleUpload}
          handleDelete={(id) => {
            const video = clonacionVideos.find((v) => v.id === id);
            if (!video) return;
            return handleDelete(id, video.storagePath);
          }}
          uploading={uploading}
          progress={progress}
        />
        {/* Voces */}
        <VoicesListContainer
          variant="card"
          title={t("userPage.clonacion.voicesTitle")}
        />
      </div>
    </div>
  );
}
