# Push Notifications — Setup Guide

Everything is wired up in the code. Two things only **you** can do, because
they need access to your Firebase and Vercel accounts (Claude can't do this
part — these are private keys that must never be shared).

---

## 1. Get your VAPID key (5 min)

1. Open the [Firebase Console](https://console.firebase.google.com) → your
   project (**bonge-96f37**).
2. ⚙️ **Project Settings** → **Cloud Messaging** tab.
3. Scroll to **Web Push certificates** → click **Generate key pair**.
4. Copy the long key shown (starts with something like `B...`).
5. Paste it into **two places** in the code, replacing
   `PASTE_YOUR_VAPID_KEY_HERE`:
   - `index.html` — search for `VAPID_KEY`
   - `member.html` — search for `VAPID_KEY`

This key is public — safe to ship in client code (it just tells the browser
which Firebase project to subscribe to).

---

## 2. Get your Service Account key (5 min)

This is the **private** key that lets the server send pushes. It must never
appear in any HTML/JS file — only as a Vercel environment variable.

1. Firebase Console → ⚙️ **Project Settings** → **Service Accounts** tab.
2. Click **Generate new private key** → confirm. A `.json` file downloads.
3. Open that file, copy its entire contents.
4. Go to your [Vercel dashboard](https://vercel.com) → this project →
   **Settings** → **Environment Variables**.
5. Add a new variable:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** paste the entire JSON file contents (all on one line is fine)
   - **Environment:** Production (and Preview if you want it there too)
6. Redeploy the project (Vercel → Deployments → ⋯ → Redeploy) so the
   function picks up the new variable.

⚠️ Delete the downloaded `.json` file from your computer/downloads once
you've pasted it into Vercel — don't leave it lying around or commit it
anywhere.

---

## 3. Add a Firestore security rule for `pushTokens`

Device tokens are stored in a new collection: `pushTokens/{token}`. Add this
rule in Firebase Console → **Firestore Database** → **Rules**, inside your
existing rules block:

```
match /pushTokens/{token} {
  allow read: if false;        // only the server (admin SDK) reads these
  allow write: if request.resource.data.token == token; // device can only write its own token
}
```

This lets any visitor's browser register *its own* token, but nobody can
read the full list of tokens from the client — only the server (using the
service account) can read them to send notifications.

---

## How it works once set up

- When someone opens the app and grants notification permission, their
  device is registered in `pushTokens`.
- Whenever a payment is marked **PAID** (single check, bulk "Mark All Paid",
  on the dashboard or the standalone payment page), the app calls
  `/api/notify-payment`, which pushes a notification to **every** registered
  device: *"✅ Payment Received — [Name] paid KSh 50 — [date]"*.
- Unmarking a payment does **not** send a notification.
- Tapping the notification opens the app.
- If a device's token goes stale (app uninstalled, etc.), it's automatically
  removed from `pushTokens` the next time a send is attempted.

## Testing

Once both keys are in place:
1. Open the live site on your phone, accept the notification permission
   prompt when it appears (a few seconds after load).
2. Mark a payment as paid from the admin dashboard.
3. You should see a push notification appear (try it with the app closed,
   in the background, and in the foreground).

If nothing arrives, check the browser console for `Push setup skipped: ...`
and check the Vercel function logs for `/api/notify-payment` for errors.
