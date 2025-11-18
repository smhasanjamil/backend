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

    logger.info(`Email sent successfully to ${options.to}`, {
      messageId: response.data.messageId,
    });
  } catch (error: any) {
    // Log detailed error information
    logger.error("Failed to send email via Brevo:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      to: options.to,
      subject: options.subject,
      message: error.message,
    });

    // Extract meaningful error message
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.code ||
      error.message ||
      "Failed to send email";

    throw new Error(`Email delivery failed: ${errorMessage}`);
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

  const messages: Record<string, string> = {
    SIGNUP:
      "Welcome! Please verify your email address to complete your registration.",
    LOGIN: "Here's your login verification code.",
    FORGOT_PASSWORD: "You've requested to reset your password.",
    CHANGE_PASSWORD: "You've requested to change your password.",
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container { 
            max-width: 600px;
            margin: 40px auto;
            padding: 0;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            padding: 30px;
          }
          .otp-box { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            border-radius: 8px;
            margin: 25px 0;
          }
          .info-text {
            background: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #667eea;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer { 
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
          .warning {
            color: #dc3545;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${subjects[type] || "Verification Code"}</h1>
          </div>
          <div class="content">
            <p>${messages[type] || "Your verification code is ready."}</p>
            
            <div class="otp-box">${otp}</div>
            
            <div class="info-text">
              <p style="margin: 0;"><strong>⏱️ Valid for ${
                config.otp_expiry_minutes
              } minutes</strong></p>
            </div>
            
            <p>Enter this code to complete your ${type
              .toLowerCase()
              .replace(/_/g, " ")}.</p>
            
            <p class="warning">⚠️ If you didn't request this code, please ignore this email and ensure your account is secure.</p>
            
            <div class="footer">
              <p><strong>This is an automated message. Please do not reply to this email.</strong></p>
              <p>© ${new Date().getFullYear()} ${
    config.brevo.sender_name
  }. All rights reserved.</p>
            </div>
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
