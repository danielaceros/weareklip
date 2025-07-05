import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

function renderEmailHTML(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
          body {
            margin: 0;
            padding: 2rem;
            font-family: 'Inter', sans-serif;
            background-color: #ffffff;
            color: #000000;
          }
          .container {
            max-width: 600px;
            margin: auto;
            border: 1px solid #00000020;
            padding: 2rem;
            border-radius: 8px;
          }
          h1 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1rem;
          }
          p {
            font-size: 1rem;
            line-height: 1.5;
          }
          .footer {
            margin-top: 2rem;
            font-size: 0.875rem;
            color: #666666;
            border-top: 1px solid #eeeeee;
            padding-top: 1rem;
            text-align: center;
          }
          .footer-address {
            margin-top: 0.5rem;
            font-size: 0.75rem;
            color: #888888;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          <p>${content}</p>
          <div class="footer">
            Este correo fue enviado desde KLIP. No respondas directamente a este mensaje.
            <div class="footer-address">
              Calle del Cidro, 3. Oficina 114, 28044 Madrid
            </div>
          </div>
        </div>
      </body>
    </html>
  `
}

export async function POST(req: Request) {
  try {
    const { to, subject, content } = await req.json()

    if (!to || !subject || !content) {
      return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.eu",
      port: 465,
      secure: true,
      auth: {
        user: process.env.IONOS_USER || "hello@weareklip.com",
        pass: process.env.IONOS_PASS || "Tegucigalpa12$$",
      },
    })

    const html = renderEmailHTML(subject, content)

    const info = await transporter.sendMail({
      from: '"KLIP" <hello@weareklip.com>',
      to,
      subject,
      html,
    })

    return NextResponse.json({ success: true, messageId: info.messageId })
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error al enviar correo:", error.message)
    } else {
      console.error("Error desconocido al enviar correo:", error)
    }

    return NextResponse.json({ error: "Error al enviar el correo." }, { status: 500 })
  }
}
