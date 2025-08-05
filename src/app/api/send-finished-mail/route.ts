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
  console.log("🛬 Llamada recibida en /api/send-finished-mail");
  try {
    const { clientName, archiveLink } = await req.json();

    const subject = "¡Misión cumplida! Tu contenido ya está programado y listo";

    const content = `
      Hola ${clientName},<br><br>
      ¡Lo hemos conseguido!<br><br>
      Todo el contenido que hemos creado para ti durante este ciclo ya está programado y listo para publicarse. Puedes ver el calendario de publicaciones en tu portal.<br><br>
      Además, todos los archivos de vídeo finales están disponibles en tu archivo personal para que los descargues cuando quieras:<br><br>
      <a href="${archiveLink}" target="_blank"><strong>Acceder a la sección de archivo en el portal</strong></a><br><br>
      En las próximas semanas monitorizaremos los resultados y te prepararemos un informe de rendimiento. Pronto nos pondremos en contacto para empezar a planificar el siguiente lote de contenido.<br><br>
      Ha sido un placer trabajar contigo en este ciclo.<br><br>
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
      to: "rubengomezklip@gmail.com", // cambiar a cliente real en producción
      subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error al enviar correo 'finalizado':", error);
    return NextResponse.json({ error: "Error al enviar el correo." }, { status: 500 });
  }
}
