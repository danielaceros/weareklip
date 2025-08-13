// app/dashboard/edit/page.tsx
"use client";

import { useUserPanel } from "@/components/user/useUserPanel";
import UserProfileSection from "@/components/user/UserProfileSection";
import SubscriptionSection from "@/components/user/SubscriptionSection";
import ClonacionVideosSection from "@/components/user/ClonacionVideosSection";

export default function EditPage() {
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
      <UserProfileSection t={t}  />
      <SubscriptionSection t={t}  />
      <ClonacionVideosSection
        t={t}
        clonacionVideos={clonacionVideos}
        handleUpload={handleUpload}
        handleDelete={handleDelete}
        uploading={uploading}
        progress={progress}
      />
    </div>
  );
}
