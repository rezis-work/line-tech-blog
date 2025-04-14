import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendResetPasswordEmail(to: string, resetToken: string) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: "Reset Password",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 5px; background-color: #fff8f0;">
      <h1 style="color: #ff8c00; text-align: center;">Password Reset Request</h1>
      <p style="color: #333; font-size: 16px; line-height: 1.5;">We received a request to reset your password. Click the button below to proceed:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #ff8c00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f0f0f0; text-align: center;">
        <p style="color: #999; font-size: 12px;">© 2023 Your App Name. All rights reserved.</p>
      </div>
    </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
