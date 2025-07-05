import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const videoUrl = searchParams.get("url")

  if (!videoUrl) {
    return NextResponse.json({ error: "Falta la URL del vídeo." }, { status: 400 })
  }

  try {
    // Fetch al recurso original
    const res = await fetch(videoUrl)

    if (!res.ok) {
      return NextResponse.json({ error: "No se pudo obtener el vídeo." }, { status: 500 })
    }

    // Extraemos headers relevantes para que el navegador entienda el tipo y tamaño
    const contentType = res.headers.get("content-type") || "application/octet-stream"
    const contentLength = res.headers.get("content-length") || undefined

    // Stream del body original
    const body = res.body

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...(contentLength ? { "Content-Length": contentLength } : {}),
        // Indicamos que es para descarga
        "Content-Disposition": `attachment; filename="video.mp4"`,
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*", // Por si acaso
      },
    })
  } catch (error) {
    console.error("Error en proxy descarga vídeo:", error)
    return NextResponse.json({ error: "Error al descargar el vídeo." }, { status: 500 })
  }
}
