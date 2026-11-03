// Thin wrapper around the Resend REST API — no SDK dependency, just fetch.
// Requires RESEND_API_KEY in .env; without it, callers log and move on
// rather than crashing the request (a reset email failing to send shouldn't
// 500 the endpoint that issued the token).
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set')
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'AF Shoes <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Resend error ${res.status}: ${text}`)
  }
}

module.exports = { sendEmail }
