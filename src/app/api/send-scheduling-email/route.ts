import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDB } from '@/lib/firebase-admin';

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
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: white !important;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            margin-top: 1rem;
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
    const { clientId, clientName } = await req.json();

    // 1. Verificar estado en Firestore usando Admin SDK
    const clientRef = adminDB.doc(`users/${clientId}`);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error("Cliente no encontrado en Firestore");
    }

    const clientData = clientDoc.data();
    
    // Manejo seguro: si el campo no existe, tratarlo como primera vez
    const isFirstTime = clientData?.hasBeenScheduled !== true;

    // 2. Preparar contenido del correo
    let subject: string;
    let content: string;

    if (isFirstTime) {
      subject = "¡Tus vídeos están aprobados! Agendemos una reunión para la estrategia de publicación";
      content = `
        Hola ${clientName},<br><br>
        ¡Genial! Hemos recibido tu aprobación final para todos los vídeos y el resultado es fantástico.<br><br>
        Antes de programar su publicación, me gustaría tener una breve reunión contigo para definir la estrategia de fechas y horas que mejor se adapte a tus objetivos. Además, tengo un par de ideas para potenciar aún más los resultados que me gustaría compartir contigo.<br><br>
        Por favor, reserva un hueco en mi calendario cuando mejor te venga:<br><br>
        <a href="https://calendly.com/tu-enlace" class="button">Reservar reunión de estrategia</a><br><br>
        ¡Hablamos pronto!<br><br>
        Un saludo,<br><br>
        El equipo de KLIP
      `;
    } else {
      subject = "¡Luz verde! Estamos programando tu contenido";
      content = `
        Hola ${clientName},<br><br>
        ¡Genial! Hemos recibido tu aprobación final para todos los vídeos.<br><br>
        Nuestro equipo ya está en la fase final: programar todo el contenido en las fechas y horas que acordamos. No tienes que hacer nada más.<br><br>
        Te enviaremos un último correo cuando todo esté programado y disponible en tu archivo.<br><br>
        ¡Ya casi lo tenemos!<br><br>
        Un saludo,<br><br>
        El equipo de KLIP
      `;
    }

    // 3. Configurar transporte
    const transporter = nodemailer.createTransport({
      host: "email-smtp.eu-north-1.amazonaws.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SES_SMTP_USER!,
        pass: process.env.SES_SMTP_PASS!,
      },
    });

    // 4. Enviar siempre a Rubén (por ahora)
    const toEmail = "rubengomezklip@gmail.com";

    const html = renderEmailHTML(subject, content);

    const info = await transporter.sendMail({
      from: '"KLIP Notificaciones" <notifications@weareklip.com>',
      to: toEmail,
      subject,
      html,
    });

    // 5. Actualizar estado en Firestore si es primera vez
    if (isFirstTime) {
      await clientRef.update({
        hasBeenScheduled: true
      });
      console.log(`Campo hasBeenScheduled actualizado para ${clientId}`);
    }

    return NextResponse.json({ 
      success: true,
      messageId: info.messageId,
      emailType: isFirstTime ? "first-scheduling" : "recurring-scheduling"
    });

  } catch (error) {
    console.error("Error en send-scheduling-email:", error);
    
    // Manejo seguro del mensaje de error
    let errorMessage = "Detalles no disponibles";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: "Error al procesar la solicitud",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}