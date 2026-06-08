import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { logError, logInfo } from "./logger.js";

const AWS_REGION = process.env.AWS_REGION?.trim() ?? "";
const SNS_SENDER_ID = process.env.SNS_SENDER_ID?.trim() ?? "";
const SNS_SMS_TYPE = (process.env.SNS_SMS_TYPE?.trim() ?? "Transactional") as
  | "Transactional"
  | "Promotional";

const hasSmsConfig = Boolean(AWS_REGION);

const snsClient = hasSmsConfig
  ? new SNSClient({ region: AWS_REGION })
  : null;

export class SmsConfigError extends Error {
  constructor(message = "SMS is not configured") {
    super(message);
    this.name = "SmsConfigError";
  }
}

function redactPhoneNumber(value: string) {
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

export async function sendSms({ to, message }: { to: string; message: string }) {
  if (!snsClient || !AWS_REGION) {
    throw new SmsConfigError("Missing AWS_REGION for SMS.");
  }

  const attributes: Record<string, { DataType: "String"; StringValue: string }> = {
    "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: SNS_SMS_TYPE },
  };
  if (SNS_SENDER_ID) {
    attributes["AWS.SNS.SMS.SenderID"] = { DataType: "String", StringValue: SNS_SENDER_ID };
  }

  try {
    const response = await snsClient.send(
      new PublishCommand({
        PhoneNumber: to,
        Message: message,
        MessageAttributes: attributes,
      })
    );
    logInfo("sms.sent", {
      to: redactPhoneNumber(to),
      messageId: response.MessageId ?? null,
      senderId: SNS_SENDER_ID || null,
      smsType: SNS_SMS_TYPE,
    });
    return response;
  } catch (error) {
    const err = error as { name?: string; message?: string; $metadata?: { requestId?: string } };
    logError("sms.failed", {
      to: redactPhoneNumber(to),
      senderId: SNS_SENDER_ID || null,
      smsType: SNS_SMS_TYPE,
      errorName: err.name ?? "UnknownError",
      errorMessage: err.message ?? "Unknown SMS error",
      requestId: err.$metadata?.requestId ?? null,
    });
    throw error;
  }
}
