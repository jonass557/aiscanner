import nodemailer from 'nodemailer';
import config from '../config/index.js';
import logger from '../config/logger.js';

/**
 * Email service for verification and password-reset messages.
 *
 * Priority: Resend HTTP API (works on hosts that block outbound SMTP, e.g. Render).
 * Fallback: SMTP (Gmail) when Resend is not configured.
 * Dev mode: logs emails to console when neither is configured.
 */

let transporter = null;
let resend = null;

// Lazy-init Resend client when RESEND_API_KEY is set.
const getResend = async () => {
  if (resend) return resend;
  if (!config.email.resendApiKey) return null;

  try {
    const { Resend } = await import('resend');
    resend = new Resend(config.email.resendApiKey);
    logger.info('[email] Resend API ready (HTTP)');
    return resend;
  } catch (err) {
    logger.error(`[email] Resend init failed: ${err.message}`);
    return null;
  }
};

const getTransporter = () => {
  if (transporter) return transporter;
  if (!config.email.user || !config.email.password) return null;

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.password },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });

  transporter.verify().then(
    () => logger.info(`[email] SMTP ready (${config.email.host}:${config.email.port})`),
    (err) => logger.error(`[email] SMTP verify failed: ${err.message}`)
  );

  return transporter;
};

const send = async ({ to, subject, html }) => {
  // Priority 1: Resend HTTP API (bypasses SMTP firewall).
  const rs = await getResend();
  if (rs) {
    try {
      const { data } = await rs.emails.send({
        from: config.email.from,
        to,
        subject,
        html,
      });
      logger.info(`[email:resend] Sent "${subject}" to ${to} (id: ${data.id})`);
      return { id: data.id };
    } catch (err) {
      logger.error(`[email:resend] FAILED to send "${subject}" to ${to}: ${err.message}`);
      return { error: err.message };
    }
  }

  // Fallback 2: SMTP (Gmail pooled transporter).
  const tx = getTransporter();
  if (tx) {
    try {
      const info = await tx.sendMail({ from: config.email.from, to, subject, html });
      logger.info(`[email:smtp] Sent "${subject}" to ${to} (id: ${info.messageId})`);
      return info;
    } catch (err) {
      logger.error(`[email:smtp] FAILED to send "${subject}" to ${to}: ${err.message}`);
      return { error: err.message };
    }
  }

  // Fallback 3: mock mode (dev, no config).
  logger.info(`[email:mock] To: ${to} | Subject: ${subject}`);
  logger.debug(`[email:mock] Body: ${html}`);
  return { mocked: true };
};

const baseTemplate = (title, body, ctaText, ctaUrl) => `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0;">
      <h1 style="color: #fff; margin: 0; font-size: 22px;">AI Chart Scanner</h1>
    </div>
    <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 28px; border-radius: 0 0 12px 12px;">
      <h2 style="color: #111827; margin-top: 0;">${title}</h2>
      <p style="color: #4b5563; line-height: 1.6;">${body}</p>
      ${
        ctaUrl
          ? `<a href="${ctaUrl}" style="display:inline-block; margin-top:16px; background:#6366f1; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600;">${ctaText}</a>
             <p style="color:#9ca3af; font-size:12px; margin-top:20px;">Or copy this link: ${ctaUrl}</p>`
          : ''
      }
    </div>
    <p style="color:#9ca3af; font-size:12px; text-align:center; margin-top:16px;">© ${new Date().getFullYear()} AI Chart Scanner. All rights reserved.</p>
  </div>`;

export const sendVerificationEmail = async (user, code) => {
  const codeBlock = `
    <div style="margin:24px 0; text-align:center;">
      <div style="display:inline-block; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:10px; padding:16px 28px;">
        <span style="font-size:34px; font-weight:700; letter-spacing:10px; color:#111827; font-family:'Courier New',monospace;">${code}</span>
      </div>
      <p style="color:#9ca3af; font-size:12px; margin-top:12px;">Ce code expire dans 15 minutes.</p>
    </div>`;
  return send({
    to: user.email,
    subject: 'Votre code de vérification — AI Chart Scanner',
    html: baseTemplate(
      'Confirmez votre email',
      `Bienvenue ! Saisissez le code ci-dessous dans l'application pour activer votre compte et commencer à analyser vos graphiques.${codeBlock}`,
      null,
      null
    ),
  });
};

export const sendPasswordResetEmail = async (user, token) => {
  const url = `${config.frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
  return send({
    to: user.email,
    subject: 'Reset your password — AI Chart Scanner',
    html: baseTemplate(
      'Reset your password',
      'We received a request to reset your password. This link expires in 1 hour. If you did not request this, you can safely ignore this email.',
      'Reset Password',
      url
    ),
  });
};

export const sendWelcomeEmail = async (user) =>
  send({
    to: user.email,
    subject: 'Welcome to AI Chart Scanner',
    html: baseTemplate(
      `Welcome${user.firstName ? `, ${user.firstName}` : ''}!`,
      'Your email is verified and your account is ready. Upload a chart screenshot and get an institutional-grade analysis in seconds.',
      'Open Dashboard',
      `${config.frontendUrl}/dashboard`
    ),
  });

/**
 * Sends a real-time trading opportunity alert email to a subscriber.
 * Automatically respects the user's subscription and trading plan rules.
 */
export const sendOpportunityAlertEmail = async (user, opportunity) => {
  const isBuy = opportunity.direction === 'BUY';
  const color = isBuy ? '#10b981' : '#ef4444';
  const directionBadge = `<span style="background:${color}; color:#fff; padding:4px 10px; border-radius:6px; font-weight:700; font-size:14px;">${opportunity.direction}</span>`;

  const detailsHtml = `
    <div style="margin:20px 0; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:18px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-size:20px; font-weight:800; color:#111827;">${opportunity.symbol} (${opportunity.timeframe})</span>
        ${directionBadge}
      </div>

      <div style="margin-bottom:12px; font-size:13px; color:#4b5563;">
        <strong>Stratégie :</strong> ${opportunity.strategyMatched || 'SMC'} &bull;
        <strong>Probabilité :</strong> <span style="color:#6366f1; font-weight:700;">${opportunity.confidenceScore}%</span> &bull;
        <strong>R:R :</strong> ${opportunity.riskRewardRatio || '1:2.5'}
      </div>

      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:13px; font-family:monospace;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px 0; color:#6b7280;">Prix d'Entrée :</td>
          <td style="padding:6px 0; text-align:right; font-weight:700; color:#111827;">${opportunity.entry}</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px 0; color:#ef4444;">Stop Loss :</td>
          <td style="padding:6px 0; text-align:right; font-weight:700; color:#ef4444;">${opportunity.stopLoss}</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px 0; color:#10b981;">Take Profit 1 :</td>
          <td style="padding:6px 0; text-align:right; font-weight:700; color:#10b981;">${opportunity.takeProfit1}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#10b981;">Take Profit 2 :</td>
          <td style="padding:6px 0; text-align:right; font-weight:700; color:#10b981;">${opportunity.takeProfit2}</td>
        </tr>
      </table>

      ${
        opportunity.rationale
          ? `<p style="margin-top:14px; font-size:13px; color:#374151; line-height:1.5;"><strong>Analyse :</strong> ${opportunity.rationale}</p>`
          : ''
      }
    </div>
  `;

  return send({
    to: user.email,
    subject: `🚨 Opportunité Détectée : ${opportunity.direction} sur ${opportunity.symbol} (${opportunity.confidenceScore}%)`,
    html: baseTemplate(
      `Nouvelle Opportunité en Temps Réel`,
      `L'Opportunity Scanner a identifié un setup à haute probabilité de réussite aligné avec votre stratégie :${detailsHtml}`,
      'Consulter sur la Plateforme',
      `${config.frontendUrl}/dashboard/opportunities`
    ),
  });
};
