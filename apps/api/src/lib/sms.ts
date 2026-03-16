import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

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

  await snsClient.send(
    new PublishCommand({
      PhoneNumber: to,
      Message: message,
      MessageAttributes: attributes,
    })
  );
}
