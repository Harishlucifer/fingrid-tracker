/**
 * Deliver queued notifications after the HTTP response has been sent.
 *
 * `after()` is what makes this safe: work scheduled inside it runs once the
 * response has streamed, so a slow SES call never delays the user. Without it,
 * background work started in a route handler can be killed when the response
 * completes — the email would be queued but silently never sent.
 *
 * Every call is guarded: a mailer failure must never turn a successful mutation
 * into a 500, because the row is already durably queued and will be retried.
 */

import { after } from "next/server";

import { deliverPending } from "./dispatch";

export function flushNotificationsAfterResponse(): void {
  after(async () => {
    try {
      const report = await deliverPending();
      if (report.attempted > 0) {
        console.info("[notifications] delivery", report);
      }
    } catch (error) {
      // Nothing is lost: the rows stay PENDING for the next flush or a retry.
      console.error("[notifications] flush failed", error);
    }
  });
}
