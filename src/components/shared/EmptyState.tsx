export default function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 border border-dashed border-gray-300 rounded text-center text-muted-foreground">
      {children}
    </div>
  )
}