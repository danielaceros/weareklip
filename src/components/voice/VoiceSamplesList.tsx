"use client";

interface Sample {
  name: string;
  duration: number;
  url: string;
}

interface VoiceSamplesListProps {
  samples: Sample[];
  uploadProgress: { [key: string]: number };
  onRemove: (name: string) => void;
}

export function VoiceSamplesList({ samples, uploadProgress, onRemove }: VoiceSamplesListProps) {
  if (samples.length === 0) return null;

  return (
    <div className="mt-6 space-y-3">
      <h2 className="font-semibold">Muestras:</h2>
      {samples.map(({ name, duration, url }) => (
        <div key={name} className="flex flex-col gap-2 p-3 bg-gray-100 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium break-all">{name}</p>
              <p className="text-xs text-gray-500">{Math.round(duration)} segundos</p>
            </div>
            <button
              onClick={() => onRemove(name)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              ❌ Eliminar
            </button>
          </div>
          {uploadProgress[name] !== undefined ? (
            <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 transition-all duration-200"
                style={{ width: `${uploadProgress[name]}%` }}
              />
            </div>
          ) : (
            <audio controls src={url} className="w-full" />
          )}
        </div>
      ))}
    </div>
  );
}
