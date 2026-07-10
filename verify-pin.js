// /api/verify-pin.js
//
// Replaces the old client-side flow where member.html read the ENTIRE
// tracker/memberPins document (every member's phone -> PIN) directly from
// Firestore to check a login. That let anyone with dev tools dump every
// PIN in one query. Now:
//
//   1. Client POSTs { phone, pin } here.
//   2. This function reads memberPins server-side via the Admin SDK
//      (bypasses Firestore rules entirely — that's fine, it never leaves
//      the server).
//   3. On a match, it mints a Firebase custom token with the member's
//      normalised phone baked in as a custom claim.
//   4. Client calls signInWithCustomToken(auth, token) instead of
//      signInAnonymously(). From then on, request.auth.token.phone is
//      available in firestore.rules, so per-member documents (e.g.
//      welfare_<phone>) can be scoped to their real owner instead of
//      "any signed-in visitor."
//
// ── SETUP REQUIRED ──
// Same FIREBASE_SERVICE_ACCOUNT env var already used by notify-payment.js.
// Nothing new to configure if that's already set up.
//
// ── BRUTE-FORCE PROTECTION ──
// PINs are 4 digits (10,000 combinations), so this endpoint rate-limits by
// phone number: 5 wrong attempts locks that phone out for 15 minutes. This
// also fixes the fact that the old client-side check had no throttling at
// all — someone could script through every 4-digit PIN for a given phone
// in seconds.

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

function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.length === 9) return '254' + digits;
  return digits;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

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

  const { phone, pin } = req.body || {};
  if (!phone || !pin) {
    return res.status(400).json({ error: 'phone and pin are required' });
  }

  const normPhone = normalisePhone(phone);
  if (!normPhone) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const db = admin.firestore(app);
  const attemptsRef = db.collection('loginAttempts').doc(normPhone);

  try {
    // ── Rate limit check ──
    const attemptsSnap = await attemptsRef.get();
    const attempts = attemptsSnap.exists ? attemptsSnap.data() : null;
    if (attempts && attempts.count >= MAX_ATTEMPTS) {
      const elapsed = Date.now() - (attempts.lastAttempt?.toMillis?.() || 0);
      if (elapsed < LOCKOUT_MS) {
        const waitMins = Math.ceil((LOCKOUT_MS - elapsed) / 60000);
        return res.status(429).json({
          error: `Too many attempts. Try again in ${waitMins} minute${waitMins === 1 ? '' : 's'}.`
        });
      }
    }

    // ── Look up PIN ──
    const pinsSnap = await db.collection('tracker').doc('memberPins').get();
    const pinsData = pinsSnap.exists ? pinsSnap.data() || {} : {};

    let matchedPhone = Object.keys(pinsData).find(
      (k) => !k.startsWith('_meta_') && normalisePhone(k) === normPhone
    );

    const storedPin = matchedPhone ? String(pinsData[matchedPhone] || '') : '';

    if (!matchedPhone || !storedPin || String(pin).trim() !== storedPin) {
      // Record the failed attempt.
      await attemptsRef.set(
        {
          count: admin.firestore.FieldValue.increment(1),
          lastAttempt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      return res.status(401).json({ error: 'Phone number or PIN is incorrect.' });
    }

    // ── Success: clear rate limit, resolve name, mint token ──
    await attemptsRef.delete().catch(() => {});

    const meta = pinsData['_meta_' + matchedPhone] || {};
    let memberName = meta.name || '';
    if (!memberName) {
      const membersSnap = await db.collection('tracker').doc('members').get();
      const list = membersSnap.exists ? membersSnap.data().list || [] : [];
      const found = list.find((m) => normalisePhone(m.phone) === normPhone);
      if (found && found.name) memberName = found.name;
    }
    if (!memberName) memberName = matchedPhone;

    // Deterministic UID per phone so repeat logins map to the same Firebase
    // Auth user (useful if you later want per-member usage tracking).
    const uid = 'member_' + normPhone;
    const token = await admin.auth().createCustomToken(uid, {
      phone: normPhone,
      memberLogin: true,
      forcePinChange: meta.adminSet === true
    });

    return res.status(200).json({ token, name: memberName, phone: matchedPhone });
  } catch (e) {
    console.error('verify-pin error:', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
