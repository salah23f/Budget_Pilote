/**
 * Premium HTML email templates for Flyeas.
 * Dark theme, glassmorphism, gradient CTAs — Apple/Revolut-level design.
 * All templates return { subject, html } and use inline CSS only.
 */

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */
/* ------------------------------------------------------------------ */

const BRAND = 'Flyeas';
const SITE = 'faregenie.vercel.app';
const GRADIENT = 'linear-gradient(135deg, #F59E0B, #F97316)';

const wrapper = (inner: string) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#18181B;font-family:Inter,system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#18181B;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0C0A09;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
    ${inner}
    <tr><td style="padding:32px 32px 24px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="margin:0;font-size:11px;line-height:1.5;color:rgba(255,255,255,0.25);text-align:center;">
        ${BRAND} &mdash; AI Travel Agent &middot; ${SITE}
      </p>
      <p style="margin:8px 0 0;font-size:11px;line-height:1.5;color:rgba(255,255,255,0.18);text-align:center;">
        You are receiving this because you signed up or created a mission on ${BRAND}.<br/>
        To stop these emails, update your notification settings in your dashboard.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

const brandHeader = () => `
<tr><td style="padding:32px 32px 0;text-align:center;">
  <div style="display:inline-block;padding:8px 20px;background:${GRADIENT};border-radius:12px;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;">
    ${BRAND}
  </div>
</td></tr>`;

const ctaButton = (label: string, href: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
  <tr><td style="border-radius:12px;background:${GRADIENT};">
    <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.01em;">
      ${label}
    </a>
  </td></tr>
</table>`;

const badge = (text: string, bg: string) =>
  `<span style="display:inline-block;padding:3px 10px;border-radius:6px;background:${bg};color:#fff;font-size:12px;font-weight:700;letter-spacing:0.02em;">${text}</span>`;

const detailRow = (label: string, value: string) => `
<tr>
  <td style="padding:6px 0;font-size:13px;color:rgba(255,255,255,0.45);width:120px;vertical-align:top;">${label}</td>
  <td style="padding:6px 0;font-size:13px;color:rgba(255,255,255,0.85);font-weight:600;">${value}</td>
</tr>`;

/* ------------------------------------------------------------------ */
/*  1. Mission Created                                                 */
/* ------------------------------------------------------------------ */

export function missionCreatedEmail(data: {
  userName: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  maxBudget: number;
  cabinClass: string;
  missionId: string;
}): { subject: string; html: string } {
  const dates = data.returnDate
    ? `${data.departDate} &rarr; ${data.returnDate}`
    : data.departDate;

  const subject = `Mission created: ${data.origin} to ${data.destination}`;

  const html = wrapper(`
    ${brandHeader()}
    <tr><td style="padding:28px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff;">Mission Active</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.55);">
        ${data.userName}, your agent is now monitoring flights for this route. You will be notified the moment we find a deal.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.06);padding:16px;">
        <tr><td style="padding:16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${detailRow('Route', `${data.origin} &rarr; ${data.destination}`)}
            ${detailRow('Dates', dates)}
            ${detailRow('Budget', `$${data.maxBudget.toLocaleString()}`)}
            ${detailRow('Cabin', data.cabinClass)}
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      ${ctaButton('Track Your Mission', `https://${SITE}/missions/${data.missionId}/cockpit`)}
    </td></tr>
  `);

  return { subject, html };
}

/* ------------------------------------------------------------------ */
/*  2. Deal Found                                                      */
/* ------------------------------------------------------------------ */

export function dealFoundEmail(data: {
  userName: string;
  origin: string;
  destination: string;
  airline: string;
  price: number;
  oldPrice?: number;
  percentOff?: number;
  departureTime: string;
  deepLink: string;
  missionId: string;
}): { subject: string; html: string } {
  const subject = `Deal found: $${data.price} ${data.origin} to ${data.destination} on ${data.airline}`;

  const priceHtml = data.oldPrice
    ? `<span style="font-size:14px;color:rgba(255,255,255,0.35);text-decoration:line-through;margin-right:8px;">$${data.oldPrice}</span>
       <span style="font-size:28px;font-weight:800;color:#fff;">$${data.price}</span>`
    : `<span style="font-size:28px;font-weight:800;color:#fff;">$${data.price}</span>`;

  const percentBadge =
    data.percentOff && data.percentOff > 0
      ? `<span style="margin-left:10px;">${badge(`${data.percentOff}% OFF`, '#16A34A')}</span>`
      : '';

  const html = wrapper(`
    ${brandHeader()}
    <tr><td style="padding:28px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff;">Deal Found</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.55);">
        ${data.userName}, your agent found a flight worth booking.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:rgba(255,255,255,0.9);">
            ${data.airline}
          </p>
          <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.45);">
            ${data.origin} &rarr; ${data.destination} &middot; ${data.departureTime}
          </p>
          <div style="margin:0 0 4px;">
            ${priceHtml}${percentBadge}
          </div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      ${ctaButton('Book Now', data.deepLink)}
      <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);text-align:center;">
        <a href="https://${SITE}/missions/${data.missionId}/cockpit" style="color:rgba(255,255,255,0.4);text-decoration:underline;">View mission cockpit</a>
      </p>
    </td></tr>
  `);

  return { subject, html };
}

/* ------------------------------------------------------------------ */
/*  3. Price Drop Alert                                                */
/* ------------------------------------------------------------------ */

export function priceDropAlertEmail(data: {
  userName: string;
  origin: string;
  destination: string;
  airline: string;
  oldPrice: number;
  newPrice: number;
  percentDrop: number;
  deepLink: string;
}): { subject: string; html: string } {
  const subject = `Price drop: ${data.origin}-${data.destination} now $${data.newPrice} (${data.percentDrop}% off)`;

  const html = wrapper(`
    ${brandHeader()}
    <tr><td style="padding:28px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff;">Price Drop</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.55);">
        ${data.userName}, a route you are tracking just got cheaper.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:rgba(255,255,255,0.9);">
            ${data.airline}
          </p>
          <p style="margin:0 0 20px;font-size:13px;color:rgba(255,255,255,0.45);">
            ${data.origin} &rarr; ${data.destination}
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:20px;vertical-align:bottom;">
                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.05em;">Was</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:rgba(255,255,255,0.35);text-decoration:line-through;">$${data.oldPrice}</p>
              </td>
              <td style="padding-right:20px;vertical-align:bottom;">
                <p style="margin:0;font-size:11px;color:#22C55E;text-transform:uppercase;letter-spacing:0.05em;">Now</p>
                <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#fff;">$${data.newPrice}</p>
              </td>
              <td style="vertical-align:bottom;">
                ${badge(`${data.percentDrop}% DROP`, '#16A34A')}
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      ${ctaButton('Book Before It Goes Up', data.deepLink)}
    </td></tr>
  `);

  return { subject, html };
}

/* ------------------------------------------------------------------ */
/*  4. Welcome Email                                                   */
/* ------------------------------------------------------------------ */

export function welcomeEmail(data: {
  userName: string;
}): { subject: string; html: string } {
  const subject = `Welcome to ${BRAND} -- Your Travel Intelligence Starts Now`;

  const features = [
    'AI-powered fare monitoring that watches prices 24/7',
    'Instant alerts when prices drop on your tracked routes',
    'Smart auto-buy -- your agent books when the price is right',
    'Statistical price predictions backed by historical data',
    'One-click deep links to complete your booking',
  ];

  const featureList = features
    .map(
      (f) =>
        `<tr><td style="padding:6px 0;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.6);">
          <span style="color:rgba(255,255,255,0.25);margin-right:8px;">&mdash;</span>${f}
        </td></tr>`
    )
    .join('');

  const html = wrapper(`
    <tr><td style="padding:0;">
      <div style="padding:40px 32px 32px;background:${GRADIENT};text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.02em;margin-bottom:8px;">
          ${BRAND}
        </div>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);font-weight:500;">AI Travel Agent</p>
      </div>
    </td></tr>
    <tr><td style="padding:28px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff;">Welcome aboard, ${data.userName}</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.55);">
        You now have access to an AI travel agent that never sleeps. Here is what ${BRAND} does for you:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
        <tr><td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${featureList}
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      ${ctaButton('Explore Flights', `https://${SITE}/flights`)}
    </td></tr>
  `);

  return { subject, html };
}
