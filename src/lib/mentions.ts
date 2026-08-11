/**
 * @mention parsing.
 *
 * Lives in `lib/` rather than in the comment service so it stays a pure
 * function with no database import — which is what lets it be unit-tested
 * without a live MySQL connection.
 */

/**
 * Extract @mentions from a comment body.
 *
 * Mentions are written as `@email`, not `@displayname` — an email is
 * unambiguous, whereas display names collide and would need disambiguation UI.
 * Resolving those emails to users, and rejecting anyone who is not a project
 * member, is the caller's job.
 */
export function parseMentionEmails(body: string): string[] {
  if (typeof body !== "string" || !body) return [];

  const matches = body.matchAll(
    /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
  );

  const emails = new Set<string>();
  for (const match of matches) {
    if (match[1]) emails.add(match[1].toLowerCase());
  }
  return [...emails];
}
