// /api/notify-payment.js
//
// Sends a push notification to every device that has installed the app
// and granted notification permission. Triggered from the client whenever
// a payment is marked PAID.
//
// ── SETUP REQUIRED ──
// 1. Firebase Console → Project Settings → Service Accounts → Generate new
//    private key. This downloads a JSON file.
// 2. In Vercel → your project → Settings → Environment Variables, add:
//      FIREBASE_SERVICE_ACCOUNT = <paste the entire JSON file contents>
// 3. Redeploy. That's it — this function reads it from env at runtime.
//
// Nothing here ever touches the browser; the service account key stays
// server-side only, which is required (it can send unlimited pushes if leaked).

import admin from 'firebase-admin';

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  const serviceAccount = JSON.parse(raw);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let app;
  try {
    app = getAdminApp();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server not configured for push notifications' });
  }

  const { title, body, url } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }

  const db = admin.firestore(app);
  const tokensSnap = await db.collection('pushTokens').get();
  const tokens = tokensSnap.docs.map((d) => d.id).filter(Boolean);

  if (tokens.length === 0) {
    return res.status(200).json({ sent: 0, failed: 0, message: 'No registered devices' });
  }

  const messaging = admin.messaging(app);
  let sent = 0;
  let failed = 0;
  const deadTokens = [];

  // sendEachForMulticast handles batches of up to 500 tokens
  const BATCH_SIZE = 500;
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const message = {
      tokens: batch,
      notification: { title, body },
      data: { url: url || '/' },
      webpush: {
        fcmOptions: { link: url || '/' },
        notification: { icon: '/icon-192.png', badge: '/icon-32.png' }
      }
    };
    const result = await messaging.sendEachForMulticast(message);
    result.responses.forEach((r, idx) => {
      if (r.success) {
        sent++;
      } else {
        failed++;
        // Clean up tokens that are no longer valid (uninstalled, expired, etc.)
        const code = r.error && r.error.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          deadTokens.push(batch[idx]);
        }
      }
    });
  }

  if (deadTokens.length) {
    const batchDel = db.batch();
    deadTokens.forEach((t) => batchDel.delete(db.collection('pushTokens').doc(t)));
    await batchDel.commit().catch(() => {});
  }

  return res.status(200).json({ sent, failed, cleaned: deadTokens.length });
}
