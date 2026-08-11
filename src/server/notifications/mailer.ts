/**
 * Outbound email behind a two-method interface.
 *
 * Same factory shape as `src/server/storage/` — and the same reason: local
 * development must not need AWS credentials. `MAIL_DRIVER=log` prints the
 * message to the server console, `MAIL_DRIVER=ses` actually sends.
 *
 * Mirrors how `alpha-api` wraps its email providers (SendGrid, Netcore) in
 * `app/factory/`, so swapping provider never touches a call site.
 */

import { resolveAwsCredentials } from "@/lib/aws-credentials";
import { env } from "@/lib/env";

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendResult = {
  /** Provider-side id, stored for support/tracing. Null for the log driver. */
  messageId: string | null;
};

export interface Mailer {
  send(message: OutboundEmail): Promise<SendResult>;
  /** Human-readable driver name, for logs and the admin screen. */
  readonly name: string;
}

/**
 * Dev/test driver. Deliberately not a silent no-op: it logs the full message so
 * you can see exactly what would have been sent, and copy a link out of it.
 */
function createLogMailer(): Mailer {
  return {
    name: "log",
    async send(message) {
      console.info(
        [
          "",
          "──────── email (MAIL_DRIVER=log, not actually sent) ────────",
          `to:      ${message.to}`,
          `from:    ${env.mailFrom ?? "(MAIL_FROM unset)"}`,
          `subject: ${message.subject}`,
          "",
          message.text,
          "───────────────────────────────────────────────────────────",
        ].join("\n"),
      );
      return { messageId: null };
    },
  };
}

/**
 * Amazon SES v2.
 *
 * Credentials come from `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY` if set,
 * else the shared `AWS_*` pair, else the SDK's default provider chain. Keeping a
 * separate SES key means the mail credential needs only `ses:SendEmail` and
 * cannot read the attachment bucket.
 */
function createSesMailer(): Mailer {
  const region = env.sesRegion;
  const from = env.mailFrom;

  if (!from) {
    throw new Error(
      "MAIL_FROM must be set when MAIL_DRIVER=ses. It has to be an identity verified in SES.",
    );
  }

  const credentials = resolveAwsCredentials("SES");

  // Imported lazily so the SDK is not loaded (or required) under MAIL_DRIVER=log.
  let clientPromise: Promise<import("@aws-sdk/client-sesv2").SESv2Client> | null =
    null;

  async function getClient() {
    if (!clientPromise) {
      clientPromise = import("@aws-sdk/client-sesv2").then(
        ({ SESv2Client }) =>
          new SESv2Client({
            region,
            // Omitted when unset so the default provider chain applies.
            ...(credentials ? { credentials } : {}),
          }),
      );
    }
    return clientPromise;
  }

  return {
    name: "ses",
    async send(message) {
      const [client, { SendEmailCommand }] = await Promise.all([
        getClient(),
        import("@aws-sdk/client-sesv2"),
      ]);

      const response = await client.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [message.to] },
          // A configuration set is what routes bounces/complaints to SNS. Without
          // one, repeated bounces damage the sending reputation invisibly.
          ...(env.sesConfigurationSet
            ? { ConfigurationSetName: env.sesConfigurationSet }
            : {}),
          Content: {
            Simple: {
              Subject: { Data: message.subject, Charset: "UTF-8" },
              Body: {
                Text: { Data: message.text, Charset: "UTF-8" },
                Html: { Data: message.html, Charset: "UTF-8" },
              },
            },
          },
        }),
      );

      return { messageId: response.MessageId ?? null };
    },
  };
}

let cached: Mailer | null = null;

export function getMailer(): Mailer {
  if (cached) return cached;

  cached = env.mailDriver === "ses" ? createSesMailer() : createLogMailer();
  return cached;
}
