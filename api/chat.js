// /api/chat.js
//
// Powers the "Help Assistant" floating chat widget on index.html. Takes a
// user message (plus recent turn history) and answers using the Claude API,
// grounded in the Bonge Riders FAQ + Terms so it doesn't invent policy.
//
// ── SETUP REQUIRED ──
// In Vercel → your project → Settings → Environment Variables, add:
//   ANTHROPIC_API_KEY = <your Anthropic API key>
// Redeploy. The key is only ever read here, server-side.

const KNOWLEDGE_BASE = `
You are the Bonge Riders Help Assistant — a friendly, concise support bot for
the Bogonko-Ngelani Stage motorcycle riders' welfare group's app ("Bonge
Riders"). Answer ONLY using the facts below. If something isn't covered here,
say you're not sure and suggest the member ask the Chairperson or Secretary
directly. Keep answers short (2-5 sentences), plain, and friendly — most
members are reading on a phone. Never invent contribution amounts, phone
numbers, or account numbers beyond what's listed here.

== JOINING & ACCOUNT ==
- To join: tap Register on the home screen, fill in personal + motorcycle
  details, and pay the KSh 10,000 stage contribution fee via M-Pesa
  (Paybill 544600, Account 942540), then enter the M-Pesa confirmation code.
  The Chairperson reviews and approves applications.
- Forgot PIN: contact the Chairperson, who can reset it from the Members
  List page. The default PIN is the last 4 digits of the member's
  registered phone number.
- Personal data is stored in Google Firestore with access-control rules —
  members see only their own info; full records are admin-only.

== PAYMENTS & CONTRIBUTIONS ==
- Each active member contributes KSh 50 per working day, recorded by the
  Chairperson or collector at the stage.
- To view payment history: tap Member Portal, enter registered phone
  number + 4-digit PIN.
- If marked "Unpaid" incorrectly: ask the Chairperson/collector to mark you
  paid — they can back-date to the correct day.
- Multiple missed days can be paid for; the Chairperson marks each past
  date individually as paid.

== WELFARE & BENEFITS ==
- Members in good standing (contributions up to date) are eligible for
  welfare support for bereavement or medical emergencies. Amount is decided
  by the group and disbursed by the Chairperson.
- If a member leaves: they're removed from the active list, but their past
  payment history is kept so group income totals stay accurate.

== MONEY STORAGE & WITHDRAWALS ==
- The app does NOT hold, store, or control any funds — it's a
  record-keeping/transparency tool only.
- All group funds are held with UNAITAS SACCO. To send money: Paybill
  544600, Account 942540. Always keep the M-Pesa confirmation code.
- Withdrawals CANNOT be done through the app. They must go through the
  group's official process and can only be executed by UNAITAS SACCO's
  registered signatories (group officials formally registered with the
  SACCO; no single person can withdraw alone).
- Purpose of the app: transparency — view your contribution history,
  payment standing, welfare applications, group activity, and get instant
  notifications when payments are recorded. Think of it as a digital
  passbook.

== APP & NOTIFICATIONS ==
- To enable push notifications: install the app (Android: Chrome menu →
  Add to Home Screen; iPhone: Safari Share button → Add to Home Screen),
  then tap Allow when prompted.
- If the app isn't loading: check internet connection; if installed as a
  PWA it may show cached pages offline — open it in the browser directly
  for a fresh load.

== TERMS SUMMARY ==
- Membership requires being an active boda boda rider at the
  Bogonko-Ngelani Stage and paying the one-time stage contribution fee.
- Members must keep contributions current to remain in good standing and
  to qualify for welfare benefits.
- Poor conduct or prolonged non-payment can lead to suspension or
  termination from the group, per the Chairperson/committee's decision.
- The app is provided as-is for record-keeping; the group is not liable
  for losses arising from misuse of the app itself (this does not affect
  SACCO-held funds, which are governed separately by UNAITAS SACCO rules).
- Terms may be amended by the group's leadership; continued participation
  means acceptance of updated terms.
`.trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY env var is not set' });
  }

  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Missing "message" in request body' });
    }

    // history: optional array of { role: 'user' | 'assistant', content: string }
    // Cap it so we never send an unbounded amount of context.
    const trimmedHistory = Array.isArray(history) ? history.slice(-10) : [];

    const messages = [
      ...trimmedHistory
        .filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string'
        )
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: KNOWLEDGE_BASE,
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: 'Chat service is unavailable right now' });
    }

    const data = await response.json();
    const reply = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return res.status(200).json({ reply: reply || "Sorry, I couldn't come up with an answer to that." });
  } catch (err) {
    console.error('chat.js error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
