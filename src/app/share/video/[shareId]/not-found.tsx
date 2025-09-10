// src/app/share/video/[shareId]/not-found.tsx
export default function NotFound() {
  return (
    <main className="min-h-dvh bg-black text-white flex items-center justify-center p-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center max-w-md">
        <h1 className="text-lg font-semibold mb-2">Reel no disponible</h1>
        <p className="text-sm text-neutral-400">
          Este vídeo no está disponible o su enlace público ha sido desactivado.
        </p>
      </div>
    </main>
  );
}
