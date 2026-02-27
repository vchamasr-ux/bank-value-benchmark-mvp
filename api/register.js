import nodemailer from 'nodemailer';
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sub, name, email, profileUrl, consent } = req.body;

    if (!sub || !profileUrl) {
        return res.status(400).json({ error: 'Missing required registration data' });
    }

    try {
        // 1. Check if we already notified for this user
        // Bypass for testing: If a special test header is present, we allow multiple notifications
        const isTestMode = req.headers['x-test-mode'] === 'true';
        const notifiedKey = `notified:${sub}`;

        if (!isTestMode) {
            const alreadyNotified = await kv.get(notifiedKey);
            if (alreadyNotified) {
                return res.status(200).json({ message: 'User already registered' });
            }
        }

        // 2. Send email notification to admin using SMTP
        const smtpHost = process.env.SMTP_SERVER;
        const smtpPort = process.env.SMTP_PORT || 587;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_SENDER;

        if (!smtpHost || !smtpUser || !smtpPass || !adminEmail) {
            console.warn("Registration email skipped: SMTP configuration or ADMIN_EMAIL missing");
            return res.status(200).json({ message: 'Registration received (email configuration missing)' });
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort),
            secure: parseInt(smtpPort) === 465,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        await transporter.sendMail({
            from: `"Value Benchmark Alerts" <${smtpUser}>`,
            to: adminEmail,
            subject: `New User Registration: ${name}`,
            html: `
        <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
          <h1 style="color: #1e40af;">New User Signed In</h1>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email || 'Not provided'}</p>
          <p><strong>LinkedIn Profile:</strong> <a href="${profileUrl}" style="color: #2563eb;">${profileUrl}</a></p>
          <p><strong>Consent to connect:</strong> ${consent ? 'Yes' : 'No'}</p>
          <p><strong>LinkedIn Sub (ID):</strong> ${sub}</p>
        </div>
      `
        });

        // 3. Mark as notified in KV
        await kv.set(notifiedKey, true);

        return res.status(200).json({ message: 'Registration successful' });
    } catch (error) {
        console.error("Registration Notification Error:", error);
        // Don't block the user if email production fails
        return res.status(200).json({ message: 'Registration received with internal warning' });
    }
}
