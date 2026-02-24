import nodemailer from 'nodemailer';
import { ENV } from '../config/env';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: ENV.SMTP_HOST,
  port: ENV.SMTP_PORT,
  secure: ENV.SMTP_PORT === 465, // true for 465, false for 587
  auth: {
    user: ENV.SMTP_USER,
    pass: ENV.SMTP_PASS,
  },
});

export async function sendOnboardingEmail(
  to: string,
  firstName: string,
  token: string
): Promise<void> {
  const setPasswordUrl = `${ENV.FRONTEND_URL}/set-password?token=${token}`;

  await transporter.sendMail({
    from: ENV.SMTP_FROM,
    to,
    subject: 'Welcome to Pfizer Sales Platform — Set Your Password',
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;
                  background: #0a0e1a; color: #f9fafb; padding: 40px; border-radius: 12px;
                  border: 1px solid #1f2937;">
        <div style="display: flex; align-items: center; margin-bottom: 32px;">
          <div style="width: 36px; height: 36px; background: #eab308; border-radius: 8px;
                      display: inline-flex; align-items: center; justify-content: center;
                      font-weight: 900; font-size: 18px; color: #000; margin-right: 12px;">P</div>
          <span style="font-size: 18px; font-weight: 700; color: #f9fafb;">Pfizer Sales Platform</span>
        </div>

        <h1 style="color: #eab308; font-size: 24px; margin-bottom: 8px;">Welcome aboard, ${firstName}!</h1>
        <p style="color: #9ca3af; margin-bottom: 32px; line-height: 1.6;">
          You have been registered as a Sales Representative on the Pfizer Medical Industries
          Sales Territory Performance Platform.
        </p>

        <p style="margin-bottom: 24px; line-height: 1.6;">
          Please click the button below to set your password and activate your account.
          This link expires in <strong style="color: #eab308;">24 hours</strong>.
        </p>

        <a href="${setPasswordUrl}"
           style="display: inline-block; background: #eab308; color: #000; padding: 14px 28px;
                  border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;
                  margin-bottom: 32px; letter-spacing: 0.3px;">
          Set My Password →
        </a>

        <p style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">
          If the button doesn't work, copy and paste this link:
        </p>
        <p style="color: #4b5563; font-size: 12px; word-break: break-all; margin-bottom: 32px;">
          ${setPasswordUrl}
        </p>

        <hr style="border: none; border-top: 1px solid #1f2937; margin-bottom: 24px;"/>
        <p style="color: #6b7280; font-size: 12px;">
          If you did not expect this email, please ignore it.
        </p>
        <p style="color: #4b5563; font-size: 12px; margin-top: 4px;">
          &copy; 2024 Pfizer Medical Industries. All rights reserved.
        </p>
      </div>
    `,
  });
}
