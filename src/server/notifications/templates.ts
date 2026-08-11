/**
 * Email rendering. Pure functions — no database, no AWS — so they are
 * unit-tested in `tests/notification-templates.test.ts`.
 *
 * Two rules that matter here:
 *
 *  1. **Everything user-supplied is HTML-escaped.** A task titled
 *     `<img onerror=...>` must not become live markup in someone's inbox.
 *  2. **Every email has a plain-text part.** An HTML-only message scores badly
 *     with spam filters and is unreadable in text-only clients.
 *
 * Layout is deliberately inline-styled and table-free-but-simple: email clients
 * strip <style> blocks and support almost no modern CSS.
 */

export const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED",
  "COMMENT_MENTION",
  "TASK_COMMENT",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

/** Escape the five characters that matter in HTML text and attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Collapse whitespace and hard-truncate, for excerpts and subject lines. */
export function truncate(value: string, max: number): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

type Actor = { name: string | null; email: string };

function actorLabel(actor: Actor): string {
  return actor.name?.trim() || actor.email;
}

/** Shell shared by every notification, so they look like one product. */
function layout(args: {
  heading: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
}): string {
  return `<!-- Inforvio PM notification -->
<div style="margin:0;padding:24px;background:#f4f7fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e7ef;border-radius:12px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #e3e7ef;">
      <span style="display:inline-block;background:#012756;color:#ffffff;font-size:11px;font-weight:700;padding:6px 8px;border-radius:6px;">PM</span>
      <span style="margin-left:8px;font-size:14px;font-weight:600;color:#041124;">Inforvio PM</span>
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 12px;font-size:17px;line-height:1.4;color:#041124;font-weight:600;">${args.heading}</h1>
      ${args.bodyHtml}
      <a href="${escapeHtml(args.ctaUrl)}" style="display:inline-block;margin-top:20px;background:#012756;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">${escapeHtml(args.ctaLabel)}</a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e3e7ef;background:#f8faff;">
      <p style="margin:0;font-size:12px;line-height:1.5;color:#64708a;">${args.footer}</p>
    </div>
  </div>
</div>`;
}

const FOOTER =
  "You are receiving this because you are a member of this project in Inforvio PM.";

export type TaskAssignedInput = {
  actor: Actor;
  taskRef: string;
  taskTitle: string;
  projectName: string;
  taskUrl: string;
  /** Null when the task has no due date. */
  dueDate?: string | null;
  priority?: string;
};

export function renderTaskAssigned(input: TaskAssignedInput): RenderedEmail {
  const who = actorLabel(input.actor);
  const subject = `${input.taskRef}: ${truncate(input.taskTitle, 80)} — assigned to you`;

  const details = [
    `Project: ${input.projectName}`,
    input.priority ? `Priority: ${input.priority}` : null,
    input.dueDate ? `Due: ${input.dueDate}` : null,
  ].filter(Boolean) as string[];

  const text = [
    `${who} assigned ${input.taskRef} to you.`,
    "",
    input.taskTitle,
    "",
    ...details,
    "",
    `Open it: ${input.taskUrl}`,
    "",
    FOOTER,
  ].join("\n");

  const html = layout({
    heading: `${escapeHtml(who)} assigned a task to you`,
    bodyHtml: `
      <p style="margin:0 0 4px;font-size:12px;color:#64708a;font-family:ui-monospace,monospace;">${escapeHtml(input.taskRef)}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#041124;font-weight:500;">${escapeHtml(input.taskTitle)}</p>
      ${details
        .map(
          (line) =>
            `<p style="margin:0 0 4px;font-size:13px;color:#33415c;">${escapeHtml(line)}</p>`,
        )
        .join("")}`,
    ctaLabel: "Open task",
    ctaUrl: input.taskUrl,
    footer: FOOTER,
  });

  return { subject, text, html };
}

export type CommentInput = {
  actor: Actor;
  taskRef: string;
  taskTitle: string;
  projectName: string;
  taskUrl: string;
  commentBody: string;
};

export function renderCommentMention(input: CommentInput): RenderedEmail {
  const who = actorLabel(input.actor);
  const subject = `${input.taskRef}: ${who} mentioned you`;
  const excerpt = truncate(input.commentBody, 400);

  const text = [
    `${who} mentioned you in a comment on ${input.taskRef} (${input.taskTitle}).`,
    "",
    excerpt,
    "",
    `Reply: ${input.taskUrl}`,
    "",
    FOOTER,
  ].join("\n");

  const html = layout({
    heading: `${escapeHtml(who)} mentioned you`,
    bodyHtml: `
      <p style="margin:0 0 4px;font-size:12px;color:#64708a;font-family:ui-monospace,monospace;">${escapeHtml(input.taskRef)} · ${escapeHtml(input.projectName)}</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#041124;font-weight:500;">${escapeHtml(input.taskTitle)}</p>
      <blockquote style="margin:0;padding:12px 14px;border-left:3px solid #3185ff;background:#f8faff;font-size:14px;line-height:1.6;color:#33415c;white-space:pre-wrap;">${escapeHtml(excerpt)}</blockquote>`,
    ctaLabel: "View comment",
    ctaUrl: input.taskUrl,
    footer: FOOTER,
  });

  return { subject, text, html };
}

export function renderTaskComment(input: CommentInput): RenderedEmail {
  const who = actorLabel(input.actor);
  const subject = `${input.taskRef}: new comment from ${who}`;
  const excerpt = truncate(input.commentBody, 400);

  const text = [
    `${who} commented on ${input.taskRef} (${input.taskTitle}).`,
    "",
    excerpt,
    "",
    `Reply: ${input.taskUrl}`,
    "",
    FOOTER,
  ].join("\n");

  const html = layout({
    heading: `New comment on ${escapeHtml(input.taskRef)}`,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#041124;font-weight:500;">${escapeHtml(input.taskTitle)}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64708a;">${escapeHtml(who)} wrote:</p>
      <blockquote style="margin:0;padding:12px 14px;border-left:3px solid #e3e7ef;background:#f8faff;font-size:14px;line-height:1.6;color:#33415c;white-space:pre-wrap;">${escapeHtml(excerpt)}</blockquote>`,
    ctaLabel: "Open task",
    ctaUrl: input.taskUrl,
    footer: FOOTER,
  });

  return { subject, text, html };
}

/** Absolute task URL — emails are read outside the app, so relative is useless. */
export function taskUrl(appUrl: string, taskId: string): string {
  return `${appUrl.replace(/\/+$/, "")}/tasks/${taskId}`;
}
