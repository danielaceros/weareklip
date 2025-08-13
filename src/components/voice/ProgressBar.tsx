"use client";

export function ProgressBar({ totalDuration }: { totalDuration: number }) {
  const percent = Math.min((totalDuration / 180) * 100, 100);
  const color = totalDuration < 120 ? "bg-green-500" : "bg-yellow-500";
  return (
    <div className="mt-6">
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className={`${color} h-4`}
          style={{ width: `${percent}%`, transition: "width 0.3s ease" }}
        />
      </div>
      <p className="text-xs mt-2 text-gray-500">{Math.floor(totalDuration)}s / 180s totales</p>
    </div>
  );
}
