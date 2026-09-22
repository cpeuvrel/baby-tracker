// Service worker dédié aux notifications push Firebase Cloud Messaging.
// Fichier statique (non traité par Vite) : la config web Firebase n'est pas
// secrète (protégée par les Security Rules, pas par l'obscurité), elle peut
// donc être codée en dur ici plutôt que templatée au build.
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBzK1s_hGiGWTKTshq9aeA4n666h4BNsTM',
  authDomain: 'baby-tracker-c8fd2.firebaseapp.com',
  projectId: 'baby-tracker-c8fd2',
  storageBucket: 'baby-tracker-c8fd2.firebasestorage.app',
  messagingSenderId: '190686938915',
  appId: '1:190686938915:web:408311f3102c5fe8f52e96',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Baby Tracker'
  const body = payload.notification?.body ?? ''
  self.registration.showNotification(title, { body, icon: '/favicon.svg' })
})
