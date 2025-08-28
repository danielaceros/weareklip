/* public/firebase-messaging-sw.js */
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

/* >>> CONFIG DE TU PROYECTO (la misma que en src/lib/firebase.ts) <<< */
firebase.initializeApp({
  apiKey: "AIzaSyC0s5D34lqrLYVDxC_5LrW3yifcP4sBbbI",
  authDomain: "klip-6e9a8.firebaseapp.com",
  projectId: "klip-6e9a8",
  storageBucket: "klip-6e9a8.firebasestorage.app",
  messagingSenderId: "32174180381",
  appId: "1:32174180381:web:d48749842fad36b4941ef4",
});

const messaging = firebase.messaging();

/* Notificación cuando llegue un push en BACKGROUND */
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "KLIP", {
    body: body || "",
    icon: icon || "/icon-192.png", // asegúrate de tener este icono en /public
    data: payload.data || {},
  });

  // Avisar a pestañas abiertas → lo usaremos para actualizar la campana
  try {
    const bc = new BroadcastChannel("klip-push");
    bc.postMessage({ source: "sw", payload });
  } catch {}
});

/* Al hacer click, enfocar/abrir el dashboard */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.includes(url) && "focus" in c) return c.focus();
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
