// lib/errors.ts
import { toast } from "sonner";

export function handleError(error: unknown, context: string = "Error inesperado") {
  console.error(context, error);
  
  // Extraer mensaje de error de diferentes fuentes
  let errorMessage = "Algo salió mal. Inténtalo de nuevo.";
  
  if (typeof error === "string") {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (error && typeof error === "object") {
    // Manejar errores de Firebase, Fetch API, etc.
    if ("message" in error) {
      errorMessage = (error as { message: string }).message;
    } else if ("code" in error) {
      errorMessage = (error as { code: string }).code;
    }
  }

  toast.error(`${context}: ${errorMessage}`, {
    position: "bottom-right",
    style: {
      background: '#fef2f2',
      color: '#b91c1c',
      border: '1px solid #fecaca',
    },
  });
}

export function showSuccess(message: string) {
  toast.success(message, {
    position: "bottom-right",
    style: {
      background: '#f0fdf4',
      color: '#15803d',
      border: '1px solid #bbf7d0',
    },
  });
}

export function showLoading(message: string) {
  return toast.loading(message, {
    position: "bottom-right",
  });
}

