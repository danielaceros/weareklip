"use client";

import NotificationFloating from "./NotificationFloating";

export function NotificationFloatingWrapper() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <NotificationFloating />
    </div>
  );
}
