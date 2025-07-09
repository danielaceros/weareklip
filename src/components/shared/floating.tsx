"use client"

import { TaskInboxPreview } from "@/components/shared/inbox"

export function TaskInboxFloating() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <TaskInboxPreview />
    </div>
  )
}
