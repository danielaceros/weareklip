"use client";

import { useUserPanel } from "@/components/user/useUserPanel";
import ClonacionVideosSection from "@/components/user/ClonacionVideosSection";
import VoicesListContainer from "@/components/voice/VoicesListContainer";

export default function UserPage() {
  const {
    t,
    clonacionVideos,
    handleUpload,
    handleDelete,
    uploading,
    progress,
  } = useUserPanel();

  return (
    <div className="space-y-8">
      <ClonacionVideosSection
        t={t}
        clonacionVideos={clonacionVideos}
        handleUpload={handleUpload}
        handleDelete={handleDelete}
        uploading={uploading}
        progress={progress}
      />

      <VoicesListContainer variant="card" title="🎤 Voces de clonación" />

    </div>
  );
}
