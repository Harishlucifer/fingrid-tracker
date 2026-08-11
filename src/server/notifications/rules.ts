/**
 * Who gets notified. Pure predicates, no database import — so they are
 * unit-testable, which matters because both failure modes are silent: emailing
 * someone about their own action, or mailing a deactivated account.
 */

export type NotifiableUser = {
  id: string;
  email: string;
  isActive: boolean;
};

/**
 * Should this person be emailed about an event caused by `actorId`?
 *
 * Deny by default: anything missing an address, self-triggered, or belonging to
 * a deactivated account is skipped.
 */
export function shouldNotify(
  recipient: Pick<NotifiableUser, "id" | "email" | "isActive">,
  actorId: string,
): boolean {
  if (!recipient.email) return false;
  // Never notify someone about something they did themselves.
  if (recipient.id === actorId) return false;
  // A deactivated account should not receive mail.
  if (!recipient.isActive) return false;
  return true;
}

/**
 * Resolve the final recipient list for a comment, de-duplicated.
 *
 * Mentions take precedence over watchers: being mentioned AND being the assignee
 * should produce one email, and the mention wording is the more specific one.
 * Returns the recipients tagged with which template to use.
 */
export function resolveCommentRecipients(args: {
  actorId: string;
  mentioned: NotifiableUser[];
  watchers: NotifiableUser[];
}): { user: NotifiableUser; reason: "MENTION" | "WATCHER" }[] {
  const seen = new Set<string>();
  const out: { user: NotifiableUser; reason: "MENTION" | "WATCHER" }[] = [];

  for (const user of args.mentioned) {
    if (seen.has(user.id)) continue;
    if (!shouldNotify(user, args.actorId)) continue;
    seen.add(user.id);
    out.push({ user, reason: "MENTION" });
  }

  for (const user of args.watchers) {
    if (seen.has(user.id)) continue;
    if (!shouldNotify(user, args.actorId)) continue;
    seen.add(user.id);
    out.push({ user, reason: "WATCHER" });
  }

  return out;
}
