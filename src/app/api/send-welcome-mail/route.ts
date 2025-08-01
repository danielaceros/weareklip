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
    const { clientName } = await req.json();

    const subject = "¡Bienvenido/a a KLIP! Próximos pasos";

    const content = `
      Hola ${clientName},<br><br>
      ¡Todo el equipo de KLIP te da la bienvenida! Estamos muy emocionados de empezar a crear contenido increíble para ti.<br><br>
      El primer paso es nuestra sesión de onboarding y estrategia. Es una reunión clave donde definiremos tus objetivos, el tono de tu comunicación y el camino a seguir para lograr los mejores resultados.<br><br>
      Por favor, reserva el momento que mejor te venga en el siguiente enlace:<br><br>
      <a href="https://weareklip.zohobookings.eu/#/onboarding" target="_blank">Reserva tu sesión de onboarding</a><br><br>
      ¡Tenemos muchas ganas de empezar!<br><br>
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
      to: "ruben@weareklip.com", // 👈 de momento todo va a Rubén
      subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error al enviar correo de bienvenida:", error);
    return NextResponse.json({ error: "Error al enviar el correo." }, { status: 500 });
  }
}
