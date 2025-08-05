import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

function renderEmailHTML(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
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
            border: 1px solid #ddd;
            padding: 2rem;
            border-radius: 8px;
          }
          h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; }
          p { font-size: 1rem; line-height: 1.5; }
          .footer {
            margin-top: 2rem;
            font-size: 0.875rem;
            color: #666;
            border-top: 1px solid #eee;
            padding-top: 1rem;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          <p>${content}</p>
          <div class="footer">
            Este correo fue enviado desde KLIP.<br/>
            Calle del Cidro, 3. Oficina 114, 28044 Madrid
          </div>
        </div>
      </body>
    </html>`;
}

export async function POST(req: Request) {
  try {
    const { clientName } = await req.json();

    console.log("Payload recibido en send-review-videos:", { clientName });

    const subject = "¡Importante! Tus vídeos están listos para la revisión";

    const content = `
      Hola ${clientName},<br><br>
      ¡Este es el momento que estabas esperando! Tu lote de vídeos está listo para que los revises.<br><br>
      <strong>Información importante sobre el proceso de revisión:</strong> Para mantener un flujo de trabajo ágil y eficiente, nuestro servicio incluye <strong>una única ronda de cambios por lote de vídeos</strong>. Por favor, tómate tu tiempo para revisar todo con detalle y agrupar todos tus comentarios.<br><br>
      Accede a tu portal para ver los vídeos y dejar tus comentarios directamente sobre ellos:<br><br>
      <strong>[Enlace a la sección de revisión de vídeos en el portal]</strong><br><br>
      Una vez envíes tus comentarios, nuestro equipo se pondrá a trabajar en la versión final.<br><br>
      ¡Disfruta del resultado!<br><br>
      Un saludo,<br><br>
      El equipo de KLIP
    `;

    const transporter = nodemailer.createTransport({
      host: "email-smtp.eu-north-1.amazonaws.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SES_SMTP_USER!,
        pass: process.env.SES_SMTP_PASS!,
      },
    });

    const html = renderEmailHTML(subject, content);

    const info = await transporter.sendMail({
      from: '"KLIP Notificaciones" <notifications@weareklip.com>',
      to: "rubengomezklip@gmail.com",
      subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error al enviar correo 'review videos':", error);
    return NextResponse.json({ error: "Error al enviar el correo." }, { status: 500 });
  }
}
