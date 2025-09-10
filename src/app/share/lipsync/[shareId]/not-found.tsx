export default function NotFound() {
  return (
    <main className="min-h-dvh bg-black text-white grid place-items-center p-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Reel no disponible</h1>
        <p className="text-sm text-neutral-400">
          Este enlace ha sido desactivado o el vídeo ya no es público.
        </p>
      </div>
    </main>
  );
}
