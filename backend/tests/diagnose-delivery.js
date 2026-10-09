import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import nodemailer from "nodemailer";
import { maskEmail, getEmailCredentials } from "../services/emailService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

async function testRecipients() {
  const { user, pass } = getEmailCredentials();

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass }
  });

  const testList = [
    { label: "Institutional Recipient (NEC)", email: "24104023@nec.edu.in" },
    { label: "Gmail Recipient", email: "farmconnect226@gmail.com" },
    { label: "Yahoo Recipient", email: "farmconnect226@yahoo.com" }
  ];

  for (const item of testList) {
    console.log(`\n--- Testing ${item.label} (${maskEmail(item.email)}) ---`);
    try {
      const info = await transporter.sendMail({
        from: `FarmConnect <${user}>`,
        to: item.email,
        subject: `🌾 FarmConnect Diagnostic Delivery: ${Date.now()}`,
        text: `Diagnostic test for ${item.label}. Time: ${new Date().toISOString()}`,
        html: `<p>Diagnostic test for ${item.label}. Time: ${new Date().toISOString()}</p>`
      });

      console.log("SMTP Result for", maskEmail(item.email), ":");
      console.log("  • Accepted:", info.accepted?.map(maskEmail));
      console.log("  • Rejected:", info.rejected?.map(maskEmail));
      console.log("  • Response:", info.response);
      console.log("  • MessageId:", info.messageId);
    } catch (err) {
      console.error("SMTP Failed for", maskEmail(item.email), ":", err.message);
    }
  }
}

testRecipients().catch(console.error);
