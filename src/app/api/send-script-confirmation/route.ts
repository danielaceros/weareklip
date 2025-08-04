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
    console.log("🛬 Llamada recibida en /api/send-script-confirmation");
  try {
    const { clientName, scriptsLink } = await req.json();

    console.log("Payload recibido en send-script-confirmation:", { clientName, scriptsLink });

    const subject = "¡Tus guiones están listos para revisar!";

    const content = `
      Hola ${clientName},<br><br>
      ¡Buenas noticias! Tu primer lote de guiones ya está listo para que le eches un vistazo. Hemos plasmado las ideas de nuestra sesión de estrategia en contenido que creemos que va a funcionar genial.<br><br>
      Puedes acceder a todos los guiones en tu portal de cliente. Siéntete libre de <strong>editar directamente cualquier cosa que quieras cambiar</strong> y, una vez estés conforme, apruébalos para que podamos continuar.<br><br>
      <a href="${scriptsLink}" target="_blank">Acceder a la sección de guiones en el portal</a><br><br>
      Tu aprobación es el siguiente paso para que podamos empezar con la producción de los vídeos.<br><br>
      ¡Esperamos que te gusten!<br><br>
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
      to: "rubengomezklip@gmail.com", //Correo a cliente en futuro
      subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error al enviar correo 'script confirmation':", error);
    return NextResponse.json({ error: "Error al enviar el correo." }, { status: 500 });
  }
}
