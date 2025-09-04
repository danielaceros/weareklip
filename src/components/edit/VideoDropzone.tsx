"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, VideoIcon } from "lucide-react";

interface Props {
  file: File | null;
  setFile: (file: File | null) => void;
  videoUrl: string | null;
  setVideoUrl: (url: string | null) => void;
}

export function VideoDropzone({ file, setFile, videoUrl, setVideoUrl }: Props) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setVideoUrl(null);
    }
  }, [setFile, setVideoUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: false,
    disabled: !!videoUrl,
  });

  if (videoUrl) {
    return (
      <div className="rounded-xl overflow-hidden border w-full aspect-[9/16]">
        <video src={videoUrl} controls className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer w-full aspect-[9/16] transition ${
        isDragActive ? "border-primary bg-muted" : "border-muted-foreground/50"
      }`}
    >
      <input {...getInputProps()} />
      {file ? (
        <>
          <VideoIcon className="w-10 h-10 mb-2 text-primary" />
          <p className="text-sm font-medium text-center">{file.name}</p>
        </>
      ) : (
        <>
          <UploadCloud className="w-10 h-10 mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            {isDragActive ? "Suelta el vídeo aquí..." : "Arrastra un vídeo o haz click"}
          </p>
        </>
      )}
    </div>
  );
}

