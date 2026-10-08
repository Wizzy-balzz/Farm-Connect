import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import nodemailer from "nodemailer";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });
dotenv.config(); // fallback

/**
 * Mask email address for safe diagnostic logging
 * Example: testuser@gmail.com -> te***@gmail.com
 */
export function maskEmail(email) {
  if (!email || typeof email !== "string") return "*****";
  const str = email.trim();
  if (str.includes("@")) {
    const [user, domain] = str.split("@");
    return `${user.substring(0, 2)}***@${domain}`;
  }
  return "*****";
}

/**
 * Retrieve SMTP credentials supporting both EMAIL_* and GMAIL_* environment variables
 */
export function getEmailCredentials() {
  const user = (process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim();
  const pass = (process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");
  return { user, pass };
}

/**
 * Sanitize error message to ensure credentials, app passwords, and secrets are NEVER exposed in logs
 */
export function sanitizeSmtpError(rawMsg) {
  if (!rawMsg) return "Unknown SMTP error";
  let str = typeof rawMsg === "string" ? rawMsg : (rawMsg.message || String(rawMsg));
  const { pass } = getEmailCredentials();
  if (pass && pass.length >= 4) {
    str = str.split(pass).join("[REDACTED_CREDENTIALS]");
  }
  const appPass = (process.env.GMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");
  if (appPass && appPass.length >= 4) {
    str = str.split(appPass).join("[REDACTED_CREDENTIALS]");
  }
  const emailPass = (process.env.EMAIL_PASSWORD || "").trim().replace(/\s+/g, "");
  if (emailPass && emailPass.length >= 4) {
    str = str.split(emailPass).join("[REDACTED_CREDENTIALS]");
  }
  const jwtSec = (process.env.JWT_SECRET || "").trim();
  if (jwtSec && jwtSec.length >= 4) {
    str = str.split(jwtSec).join("[REDACTED_SECRET]");
  }
  return str;
}

/**
 * Categorize SMTP errors into distinct actionable diagnostics:
 * - DNS failure (ENOTFOUND / EAI_AGAIN)
 * - Connection reset (ECONNRESET)
 * - Connection timeout (ETIMEDOUT / ESOCKETTIMEDOUT)
 * - Connection refused (ECONNREFUSED / unreachable)
 * - Authentication failure (EAUTH / 535)
 * - TLS failure (certificate / handshake)
 */
export function classifySmtpError(err) {
  if (!err) {
    return {
      category: "UNKNOWN",
      code: "UNKNOWN",
      diagnostic: "Unknown email error",
      friendlyMessage: "An unknown error occurred while sending the email."
    };
  }

  const code = (err.code || "").toUpperCase();
  const msg = (err.message || "").toLowerCase();
  const responseCode = err.responseCode;

  // 1. DNS failure
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || msg.includes("getaddrinfo enotfound") || msg.includes("enotfound")) {
    return {
      category: "DNS_FAILURE",
      code: code || "ENOTFOUND",
      diagnostic: "DNS lookup failed for SMTP host (smtp.gmail.com). Verify host DNS resolution or network connectivity.",
      friendlyMessage: "Unable to reach the email server due to DNS resolution failure. Please verify network connectivity."
    };
  }

  // 2. Connection reset
  if (code === "ECONNRESET" || msg.includes("econnreset") || msg.includes("read econnreset")) {
    return {
      category: "CONNECTION_RESET",
      code: code || "ECONNRESET",
      diagnostic: "Connection reset by Gmail SMTP or network gateway during TLS session.",
      friendlyMessage: "The connection to the email server was reset. Please try again in a moment."
    };
  }

  // 3. Connection timeout
  if (
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT" ||
    msg.includes("timed out") ||
    msg.includes("timeout")
  ) {
    return {
      category: "CONNECTION_TIMEOUT",
      code: code || "ETIMEDOUT",
      diagnostic: "Connection to Gmail SMTP port 465 timed out. Verify outbound firewall rules allow port 465.",
      friendlyMessage: "Connection to the email server timed out. Please try again shortly."
    };
  }

  // 4. Connection refused / unreachable
  if (
    code === "ECONNREFUSED" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    msg.includes("econnrefused")
  ) {
    return {
      category: "CONNECTION_REFUSED",
      code: code || "ECONNREFUSED",
      diagnostic: "Outbound connection refused or unreachable on port 465.",
      friendlyMessage: "Could not connect to the email server. Please try again later."
    };
  }

  // 5. Authentication errors
  if (
    responseCode === 535 ||
    code === "EAUTH" ||
    msg.includes("invalid login") ||
    msg.includes("badcredentials") ||
    msg.includes("username and password not accepted") ||
    msg.includes("535-5.7.8")
  ) {
    return {
      category: "AUTHENTICATION_FAILED",
      code: code || "EAUTH_535",
      diagnostic: "Gmail SMTP authentication failed. Verify EMAIL_USER/GMAIL_USER and 16-character Google App Password.",
      friendlyMessage: "Email service authentication failed. Please verify email credentials."
    };
  }

  // 6. TLS / SSL handshake errors
  if (
    code.includes("CERT_") ||
    code.includes("SSL") ||
    code.includes("TLS") ||
    msg.includes("handshake") ||
    msg.includes("tls") ||
    msg.includes("certificate")
  ) {
    return {
      category: "TLS_ERROR",
      code: code || "TLS_HANDSHAKE_ERROR",
      diagnostic: "TLS/SSL negotiation failed. Strict security and certificate validation was maintained.",
      friendlyMessage: "Secure TLS connection could not be established with email server."
    };
  }

  // 7. General SMTP / network failure
  return {
    category: "SMTP_ERROR",
    code: code || "SMTP_ERROR",
    diagnostic: sanitizeSmtpError(err.message || String(err)),
    friendlyMessage: "Email delivery failed via Gmail SMTP. Please try again."
  };
}

/**
 * Resolve configured email provider
 * Defaults to 'gmail' if EMAIL_USER/GMAIL_USER is configured, else checks EMAIL_PROVIDER or 'console'
 */
export function getEmailProvider() {
  const explicit = (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (explicit) return explicit;
  const { user, pass } = getEmailCredentials();
  if (user && pass) return "gmail";
  return "console";
}

let gmailTransporter = null;

/**
 * Get or initialize Nodemailer transporter for Gmail SMTP
 * Uses port 465, secure: true (direct TLS) as the most reliable Gmail SMTP configuration
 */
function getGmailTransporter() {
  if (gmailTransporter) {
    return gmailTransporter;
  }

  const { user, pass } = getEmailCredentials();

  if (!user || !pass) {
    throw new Error(
      "Gmail SMTP configuration incomplete: Missing EMAIL_USER/GMAIL_USER or EMAIL_PASSWORD/GMAIL_APP_PASSWORD."
    );
  }

  const host = (process.env.EMAIL_HOST || "smtp.gmail.com").trim();
  const port = parseInt(process.env.EMAIL_PORT || "465", 10);
  const secure = process.env.EMAIL_SECURE !== "false"; // true by default for port 465

  // Initialize Nodemailer with secure port 465 without disabling TLS/certificate validation
  gmailTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });

  return gmailTransporter;
}

/**
 * Verify SMTP connection and authentication safely without leaking credentials
 */
export async function verifySmtpConnection() {
  const provider = getEmailProvider();
  if (provider !== "gmail") {
    return {
      success: true,
      provider,
      message: `Active email provider is '${provider}'. Gmail SMTP verification not required.`
    };
  }

  const { user, pass } = getEmailCredentials();
  if (!user || !pass) {
    const errNotice = "Gmail credentials not configured in environment (EMAIL_USER / EMAIL_PASSWORD).";
    console.warn(`[Email Service] ${errNotice}`);
    return {
      success: false,
      provider: "gmail",
      error: errNotice,
      errorCategory: "CONFIGURATION_MISSING"
    };
  }

  try {
    const transporter = getGmailTransporter();
    await transporter.verify();
    console.log(`[Email Service] Gmail SMTP connection verified successfully (smtp.gmail.com:465)`);
    return {
      success: true,
      provider: "gmail",
      user: maskEmail(user),
      message: "Gmail SMTP connection and authentication verified successfully (smtp.gmail.com:465)."
    };
  } catch (err) {
    const classification = classifySmtpError(err);
    const sanitizedError = sanitizeSmtpError(err.message || String(err));
    console.error(
      `[Email Service] Gmail SMTP verification failed: ${classification.code} | Category: ${classification.category} | ${classification.diagnostic}`
    );
    return {
      success: false,
      provider: "gmail",
      error: sanitizedError,
      errorCode: classification.code,
      errorCategory: classification.category,
      diagnostic: classification.diagnostic
    };
  }
}

/**
 * Safe diagnostic status inspection (never exposes secrets or App Passwords)
 */
export function getEmailServiceStatus() {
  const provider = getEmailProvider();
  const { user, pass } = getEmailCredentials();
  return {
    provider,
    gmailConfigured: Boolean(user && pass),
    gmailUser: maskEmail(user),
    fromEmail: process.env.EMAIL_FROM || user || "FarmConnect <noreply@farmconnect.com>",
    smtpHost: process.env.EMAIL_HOST || "smtp.gmail.com",
    smtpPort: parseInt(process.env.EMAIL_PORT || "465", 10),
    secure: process.env.EMAIL_SECURE !== "false"
  };
}

/**
 * Core sendEmail function supporting Gmail SMTP and Console fallback
 */
export async function sendEmail({ to, subject, html, text, from }) {
  if (!to) {
    throw new Error("Recipient email ('to') is required.");
  }

  const provider = getEmailProvider();
  const recipient = to.trim().toLowerCase();
  const maskedTo = maskEmail(recipient);
  const { user } = getEmailCredentials();

  const defaultFrom =
    process.env.EMAIL_FROM && process.env.EMAIL_FROM.includes("<")
      ? process.env.EMAIL_FROM
      : user
      ? `FarmConnect <${user}>`
      : "FarmConnect <noreply@farmconnect.com>";

  const sender = from || defaultFrom;

  console.log(`[Email Service] Dispatching email to: ${maskedTo} via provider: '${provider}' | Subject: "${subject}"`);

  // Provider: Gmail SMTP via Nodemailer
  if (provider === "gmail") {
    let transporter;
    try {
      transporter = getGmailTransporter();
    } catch (configErr) {
      console.error(`[Email Service] SMTP Send Failed | Provider: ${provider} | Recipient: ${maskedTo} | Error: ${configErr.message}`);
      throw configErr;
    }

    try {
      const info = await transporter.sendMail({
        from: sender,
        to: recipient,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      });

      const isAccepted = Array.isArray(info.accepted) && info.accepted.map(e => String(e).toLowerCase()).includes(recipient);
      const isRejected = Array.isArray(info.rejected) && info.rejected.map(e => String(e).toLowerCase()).includes(recipient);

      if (isRejected || !isAccepted) {
        console.error(`[Email Service] SMTP Delivery Error | Provider: ${provider} | Recipient: ${maskedTo} | Rejected by SMTP server | Status: ${info.response || "Rejected"}`);
        throw new Error(`Email recipient ${maskedTo} was rejected by SMTP server.`);
      }

      console.log(`[Email Service] SMTP Success | Provider: ${provider} | Recipient: ${maskedTo} | Status: ${info.response || "250 OK"} | MessageId: ${info.messageId}`);
      console.log(`[Email Service] Gateway Notice: Accepted by smtp.gmail.com:465. Downstream mailbox delivery (Inbox vs Spam folder) is subject to recipient domain policies.`);

      return {
        success: true,
        provider: "gmail",
        messageId: info.messageId,
        smtpStatus: info.response || "250 OK",
        deliveryState: "accepted_by_smtp"
      };
    } catch (err) {
      const classification = classifySmtpError(err);
      const sanitizedMsg = sanitizeSmtpError(err.message || String(err));
      console.error(`[Email Service] SMTP Send Failed`);
      console.error(`Provider: ${provider}`);
      console.error(`Recipient: ${maskedTo}`);
      console.error(`Error Code: ${classification.code}`);
      console.error(`Error Category: ${classification.category}`);
      console.error(`Diagnostic: ${classification.diagnostic}`);

      const deliveryErr = new Error(`Email delivery failed via Gmail SMTP: ${sanitizedMsg}`);
      deliveryErr.code = classification.code;
      deliveryErr.category = classification.category;
      deliveryErr.friendlyMessage = classification.friendlyMessage;
      throw deliveryErr;
    }
  }

  // Provider: Console Mock / Local Dev
  console.log(`[Email Service (Console Mode)]: To: ${maskedTo} | Subject: ${subject}`);
  return {
    success: true,
    provider: "console",
    messageId: `console_${Date.now()}`,
    deliveryState: "accepted_by_console"
  };
}

/**
 * Sends a standardized FarmConnect branded OTP verification email
 */
export async function sendOtpEmail({ to, otp, purpose = "Verification" }) {
  const readablePurpose =
    purpose === "registration_verification"
      ? "Registration Verification"
      : purpose === "password_reset"
      ? "Password Reset"
      : purpose === "password_change"
      ? "Password Change"
      : purpose === "order_confirmation"
      ? "High-Value Order Confirmation"
      : purpose === "sensitive_action"
      ? "Security Action Verification"
      : purpose;

  const subject = `🌾 FarmConnect: Your ${readablePurpose} Code is ${otp}`;

  const html = `
    <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 22px;">
        <h2 style="color: #16a34a; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🌾 FarmConnect</h2>
        <p style="color: #64748b; font-size: 13.5px; margin: 4px 0 0 0;">Empowering Direct Agriculture & Transparent Marketplace</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">Hello,</p>
      <p style="font-size: 15px; line-height: 1.5; color: #334155;">
        You requested a verification code for <strong>${readablePurpose}</strong> on your FarmConnect account.
      </p>
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 22px; text-align: center; border-radius: 10px; border: 2px dashed #86efac; margin: 24px 0;">
        <span style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #15803d; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.4; margin: 12px 0;">
        ⏱️ This security code is valid for <strong>5 minutes</strong>. For your protection, never share this code with anyone.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
      <p style="color: #94a3b8; font-size: 11.5px; text-align: center; margin: 0;">
        © 2026 FarmConnect Direct Agricultural Marketplace. All rights reserved.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html
  });
}

/**
 * Sends a password reset notification/link email
 */
export async function sendPasswordResetEmail({ to, otp, resetLink }) {
  const subject = "🔐 FarmConnect: Password Reset Request";
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #16a34a; margin: 0 0 16px 0;">🌾 FarmConnect Account Security</h2>
      <p style="font-size: 15px; color: #334155;">We received a request to reset the password for your FarmConnect account.</p>
      ${
        otp
          ? `<div style="background-color: #f8fafc; padding: 16px; text-align: center; border-radius: 8px; border: 1px solid #cbd5e1; margin: 20px 0;">
               <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">Your Password Reset Verification Code:</div>
               <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #16a34a;">${otp}</span>
             </div>`
          : ""
      }
      ${
        resetLink
          ? `<p style="text-align: center; margin: 24px 0;">
               <a href="${resetLink}" style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 700;">Reset Password</a>
             </p>`
          : ""
      }
      <p style="color: #64748b; font-size: 13px;">If you did not make this request, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html
  });
}

/**
 * Sends a system or notification email
 */
export async function sendNotificationEmail({ to, title, message, actionUrl, actionLabel }) {
  const subject = `🌾 FarmConnect: ${title}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h3 style="color: #16a34a; margin: 0 0 12px 0;">🌾 FarmConnect Notification</h3>
      <h4 style="color: #1e293b; margin: 0 0 12px 0;">${title}</h4>
      <p style="font-size: 14.5px; line-height: 1.5; color: #334155;">${message}</p>
      ${
        actionUrl
          ? `<p style="margin: 20px 0;">
               <a href="${actionUrl}" style="background-color: #16a34a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">${actionLabel || "View in FarmConnect"}</a>
             </p>`
          : ""
      }
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">© 2026 FarmConnect Direct Market Platform.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html
  });
}
