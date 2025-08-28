export const NotificationTemplates = {
  // Guiones
  script_generated: ["Guion generado 🎉", "Tu guion está listo para revisar"],
  script_error: ["Error en generación", "No pudimos generar tu guion. Inténtalo de nuevo."],
  script_saved: ["Guion guardado", "Tus cambios se guardaron correctamente."],
  script_cloned: ["Guion duplicado", "Has duplicado tu guion con éxito."],
  script_deleted: ["Guion eliminado", "El guion se eliminó de tu biblioteca."],

  // Vídeos
  video_uploaded: ["Vídeo subido 📤", "Tu vídeo ya está disponible."],
  video_processing: ["Vídeo procesándose ⏳", "Te avisaremos cuando esté listo."],
  video_ready: ["Vídeo procesado 🎞️", "Tu vídeo está listo para ver/descargar."],
  video_upload_error: ["Error al subir vídeo ⚠️", "Revisa el formato y vuelve a intentar."],
  video_deleted: ["Vídeo eliminado", "Has eliminado un vídeo de tu panel."],
  video_cloned_voice: ["Vídeo con voz clonada 🎯", "Tu vídeo con voz personalizada ya está disponible."],

  // Voces
  voice_created: ["Voz creada 🗣️", "Tu voz personalizada está lista para usar."],
  voice_error: ["Error al crear voz ⚠️", "Revisa el archivo e inténtalo de nuevo."],
  voice_updated: ["Voz actualizada 🔄", "Tu voz personalizada se actualizó correctamente."],
  voice_deleted: ["Voz eliminada 🗑️", "Has eliminado una voz de tu biblioteca."],
  voice_preview: ["Preview disponible 🎧", "Ya puedes escuchar el preview de tu voz."],

  // Tareas
  task_created: ["Nueva tarea 📌", "Tu tarea se agregó al calendario."],
  task_updated: ["Tarea actualizada ✏️", "La tarea fue actualizada correctamente."],
  task_done: ["Tarea completada ✅", "¡Bien hecho! Has completado una tarea."],
  task_reminder: ["Recordatorio ⏰", "Tienes una tarea programada para hoy."],
  task_due_soon: ["Vence mañana 🔔", "Tu tarea vence mañana. No lo olvides."],
  calendar_event: ["Evento importante 📅", "Nuevo evento en tu calendario."],

  // Suscripción y cuenta
  trial_started: ["Prueba iniciada 🎉", "Tu periodo de prueba ya comenzó."],
  trial_expiring: ["Prueba por expirar ⏳", "Tu prueba termina en 2 días."],
  subscription_active: ["Suscripción activa ✅", "Tu plan está activo."],
  subscription_renewed: ["Suscripción renovada 🔁", "Tu suscripción se renovó correctamente."],
  payment_failed: ["Pago fallido ⚠️", "No pudimos procesar tu pago."],
  plan_limit_reached: ["Límite alcanzado 📉", "Has usado todos los guiones de tu plan."],
  upsell_offer: ["Mejora tu plan 📈", "Desbloquea más guiones y vídeos con Premium."],

  // Engagement
  new_templates: ["Nuevas plantillas ✨", "Ya puedes probar nuevas plantillas."],
  productivity_tip: ["Tip de productividad 💡", "Programa tus vídeos en el calendario."],
  new_feature: ["Nueva funcionalidad 🆕", "Explora la nueva herramienta."],
  monthly_report: ["Reporte mensual 📊", "Consulta tus resultados de este mes."],
  milestone_10_videos: ["¡Hito alcanzado! 🏆", "Has creado tu 10º vídeo."],
  product_update: ["Actualización de producto 🔄", "Hemos mejorado la experiencia."],
} as const;

export type EventKey = keyof typeof NotificationTemplates;
