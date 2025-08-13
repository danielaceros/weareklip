"use client";
import { LipsyncVideoCard } from "./LipsyncVideoCard";

interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  duration?: number;
}

interface LipsyncVideoListProps {
  videos: VideoData[];
}

export function LipsyncVideoList({ videos }: LipsyncVideoListProps) {
  if (videos.length === 0) {
    return <p>No tienes vídeos aún.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {videos.map((video) => (
        <LipsyncVideoCard key={video.projectId} video={video} />
      ))}
    </div>
  );
}
