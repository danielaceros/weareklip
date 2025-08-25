"use client";

import { useUserPanel } from "@/components/user/useUserPanel";
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
      <BillingSection />
    </div>
  );
}
