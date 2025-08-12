// src/types/video.ts

export type ReelEstado =
  | "Recibido"
  | "Guión aprobado"
  | "Voz generada"
  | "Vídeo creado"
  | "Entregado";

export type ReelComment = {
  id: string;
  uid: string;
  name: string;
  text: string;
  createdAt: number; // epoch ms
};

export interface Video {
  firebaseId: string;
  titulo: string;
  url: string;
  /** Estado de feedback del cliente: 0=Nuevo, 1=Cambios, 2=Aprobado */
  estado: number;
  notas?: string;

  /** Progreso de producción del reel (stepper) */
  reelEstado?: ReelEstado;

  /** Comentarios tipo Notion en el vídeo */
  comments?: ReelComment[];
}
