"use client";

import CreateReelWizard from "@/components/wizard/CreateReelWizard";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function CreateReelPage() {
  const { Modals } = useSubscriptionGate();
  const router = useRouter();

  const handleComplete = async (data: any) => {
    console.log("✅ Reel creado con datos:", data);
    toast.success("Reel creado con éxito");
    router.push("/dashboard"); // o donde quieras mostrar el nuevo reel
  };

  return (
    <>
      <CreateReelWizard onComplete={handleComplete} />
      <Modals />
    </>
  );
}
