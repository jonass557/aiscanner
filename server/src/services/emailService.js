import nodemailer from 'nodemailer';
import config from '../config/index.js';
import logger from '../config/logger.js';

/**
 * Email service for verification and password-reset messages.
 * If SMTP credentials are not configured, emails are logged to the console
 * instead of sent — so development flows work without a mail server.
 */

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!config.email.user || !config.email.password) return null;

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.password },
    // Timeouts (6 s) so a slow/blocked SMTP on the host never hangs the request.
    connectionTimeout: 6000,
    greetingTimeout: 6000,
    socketTimeout: 6000,
  });
  return transporter;
};

const send = async ({ to, subject, html }) => {
  const tx = getTransporter();
  if (!tx) {
    logger.info(`[email:mock] To: ${to} | Subject: ${subject}`);
    logger.debug(`[email:mock] Body: ${html}`);
    return { mocked: true };
  }
  try {
    const info = await tx.sendMail({ from: config.email.from, to, subject, html });
    logger.info(`[email] Sent "${subject}" to ${to} (id: ${info.messageId})`);
    return info;
  } catch (err) {
    // Never let an email failure break the request (register/verify/reset).
    // Log loudly so the cause is visible in the host logs.
    logger.error(`[email] FAILED to send "${subject}" to ${to}: ${err.message}`);
    return { error: err.message };
  }
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
