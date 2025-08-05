import "@/app/globals.css";
import { Sidebar } from "@/components/shared/sidebar";
import { NotificationFloatingWrapper } from "@/components/shared/floating";
import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-muted p-6">{children}</main>
      <NotificationFloatingWrapper />
    </div>
  );
}
