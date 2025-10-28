import axios from "axios";
import config from "../config";
import logger from "./logger";

interface IEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
}

const sendEmail = async (options: IEmailOptions): Promise<void> => {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          email: config.brevo.sender_email,
          name: config.brevo.sender_name,
        },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.htmlContent,
      },
      {
        headers: {
          "api-key": config.brevo.api_key,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 10_000,
      }
    );

    logger.info(`Email sent to ${options.to}`, { messageId: response.data.messageId });
  } catch (error: any) {
    const brevoError = error.response?.data || error.message;
    logger.error("Brevo API Error:", {
      status: error.response?.status,
      data: brevoError,
      to: options.to,
      subject: options.subject,
    });

    // Throw with real message
    throw new Error(
      brevoError?.message || brevoError || "Failed to send email"
    );
  }
};

export const sendOTPEmail = async (
  email: string,
  otp: string,
  type: string
): Promise<void> => {
  const subjects: Record<string, string> = {
    SIGNUP: "Verify Your Account",
    LOGIN: "Login Verification Code",
    FORGOT_PASSWORD: "Reset Your Password",
    CHANGE_PASSWORD: "Change Password Verification",
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .otp-box { background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; }
          .footer { margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>${subjects[type] || "Verification Code"}</h2>
          <p>Your verification code is:</p>
          <div class="otp-box">${otp}</div>
          <p>This code will expire in ${config.otp_expiry_minutes} minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: subjects[type] || "Verification Code",
    htmlContent,
  });
};

export default sendEmail;