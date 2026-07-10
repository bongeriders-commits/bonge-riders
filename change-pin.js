// /api/change-pin.js
//
// Lets a logged-in member set their own PIN. Previously member.html tried
// to write directly to tracker/memberPins from the client, which
// firestore.rules already correctly blocked (write: isAdmin() only) — so
// this feature was silently broken (see the "Ask your admin to update
// Firestore rules..." fallback message in the old code). Rather than
// opening that document up to client writes, verify the request here and
// write it with the Admin SDK.
//
// Client must send the Firebase ID token from their signInWithCustomToken
// session (see /api/verify-pin.js). We verify it server-side and only ever
// let a member overwrite their OWN entry — never anyone else's.

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
    return res.status(500).json({ error: 'Server not configured' });
  }

  const { idToken, newPin } = req.body || {};
  if (!idToken || !newPin) {
    return res.status(400).json({ error: 'idToken and newPin are required' });
  }
  if (!/^[0-9]{4,}$/.test(String(newPin))) {
    return res.status(400).json({ error: 'PIN must be at least 4 digits, numbers only.' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const phone = decoded.phone;
    if (!phone) {
      return res.status(403).json({ error: 'Not a member session.' });
    }

    const db = admin.firestore(app);
    const ref = db.collection('tracker').doc('memberPins');

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const pins = snap.exists ? snap.data() || {} : {};
      pins[phone] = String(newPin);
      const metaKey = '_meta_' + phone;
      if (pins[metaKey]) {
        pins[metaKey] = { ...pins[metaKey], adminSet: false };
      }
      tx.set(ref, pins);
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('change-pin error:', e);
    if (e.code === 'auth/id-token-expired' || e.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(500).json({ error: 'Could not save. Try again.' });
  }
}
