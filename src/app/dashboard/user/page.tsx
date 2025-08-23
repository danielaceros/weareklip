"use client";

import { useUserPanel } from "@/components/user/useUserPanel";
import UserProfileSection from "@/components/user/UserProfileSection";
import SubscriptionSection from "@/components/user/SubscriptionSection";
import ClonacionVideosSection from "@/components/user/ClonacionVideosSection";
import VoicesListContainer from "@/components/voice/VoicesListContainer";
import BillingSection from "@/components/user/BillingSection";

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
      <UserProfileSection t={t} />
      <BillingSection />
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
