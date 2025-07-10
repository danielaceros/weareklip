export interface Video {
  firebaseId: string;
  titulo: string;
  url: string;
  estado: number;  // siempre number
  notas?: string;
}
