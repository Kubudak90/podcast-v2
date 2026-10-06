import nodemailer from 'nodemailer';

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

// Local only. Production never includes the reset link in the API response,
// even if this flag is set by mistake.
export function devResetLinkEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.PASSWORD_RESET_DEV_LINK === '1';
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Reset your PodChat password',
    text: `Reset your PodChat password. This link expires in 30 minutes:\n${resetUrl}\n\nIf you did not ask for this, you can ignore this email.`,
  });
}
