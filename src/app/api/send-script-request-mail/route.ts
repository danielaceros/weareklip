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
            Este correo fue enviado desde KLIP.
            <div>Calle del Cidro, 3. Oficina 114, 28044 Madrid</div>
          </div>
        </div>
      </body>
    </html>`;
}

export async function POST(req: Request) {
  try {
    const { clientName, uploadLink, phoneNumber } = await req.json();

    const subject = "✍️ Es hora de generar tu guion";

    const content = `
      Hola ${clientName},<br><br>

      ¡La sesión de estrategia fue genial! Ya estamos trabajando en la creación de tus primeros guiones.<br><br>

      Mientras tanto, necesitamos un pequeño favor tuyo. Para poder clonar tu voz con la máxima calidad, necesitamos que grabes un vídeo corto (entre 3 y 5 minutos) y nos lo envíes.<br><br>

      Hemos preparado un vídeo corto con todas las instrucciones para que la grabación sea perfecta. Puedes verlo aquí:<br><br>

      <a href="https://drive.google.com/file/d/1b3Hti2IW4aw_6_0ppNqVttW2CS7j3p7N/view?usp=drive_link" target="_blank">Vídeo instrucciones grabación</a><br><br>

      Una vez tengas tu vídeo, puedes subirlo directamente a tu área segura en nuestro portal a través de este enlace:<br><br>

      <a href="${uploadLink}" target="_blank">${uploadLink}</a><br><br>

      Este es un paso crucial para asegurar que tus vídeos suenen exactamente como tú. Si tienes cualquier duda durante el proceso, no dudes en escribirme a mi número: ${phoneNumber}.<br><br>

      Seguimos trabajando y te avisaremos tan pronto como los guiones estén listos.<br><br>

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
      to: "dani@weareklip.com",  // Aquí va el correo real del cliente
      subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error al enviar correo 'generar guion':", error);
    return NextResponse.json({ error: "Error al enviar el correo." }, { status: 500 });
  }
}
