/**
 * Email rendering and recipient rules.
 *
 * These matter more than most tests here: an escaping slip puts live markup in
 * someone's inbox, and a recipient-rule slip emails people about their own
 * actions — both are silent failures nobody reports as a bug.
 */

import { describe, expect, it } from "vitest";

import {
  resolveCommentRecipients,
  shouldNotify,
} from "@/server/notifications/rules";
import {
  escapeHtml,
  renderCommentMention,
  renderTaskAssigned,
  renderTaskComment,
  taskUrl,
  truncate,
} from "@/server/notifications/templates";

describe("escapeHtml", () => {
  it("escapes the five characters that matter", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("neutralises an injection attempt", () => {
    const escaped = escapeHtml('<img src=x onerror="alert(1)">');
    expect(escaped).not.toContain("<img");
    expect(escaped).not.toContain('"');
    expect(escaped).toContain("&lt;img");
  });

  it("escapes ampersands before entities, not after", () => {
    // A naive implementation ordering these wrongly yields &amp;lt;
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("Ship the login fix")).toBe("Ship the login fix");
  });
});

describe("truncate", () => {
  it("collapses whitespace", () => {
    expect(truncate("a   b\n\nc", 50)).toBe("a b c");
  });

  it("leaves short strings intact", () => {
    expect(truncate("short", 20)).toBe("short");
  });

  it("truncates with an ellipsis and respects the limit", () => {
    const result = truncate("x".repeat(100), 10);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("taskUrl", () => {
  it("builds an absolute URL", () => {
    expect(taskUrl("https://pm.loanwiser.in", "abc")).toBe(
      "https://pm.loanwiser.in/tasks/abc",
    );
  });

  it("does not double the slash when the base has a trailing one", () => {
    expect(taskUrl("https://pm.loanwiser.in/", "abc")).toBe(
      "https://pm.loanwiser.in/tasks/abc",
    );
  });
});

const actor = { name: "Suresh Kumar", email: "sureshkumar@loanwiser.in" };

const taskInput = {
  actor,
  taskRef: "PMT-42",
  taskTitle: "Ship the login fix",
  projectName: "Platform",
  taskUrl: "https://pm.loanwiser.in/tasks/t1",
};

describe("renderTaskAssigned", () => {
  it("puts the ref and title in the subject", () => {
    const email = renderTaskAssigned(taskInput);
    expect(email.subject).toContain("PMT-42");
    expect(email.subject).toContain("Ship the login fix");
  });

  it("always produces both a text and an HTML part", () => {
    const email = renderTaskAssigned(taskInput);
    expect(email.text.length).toBeGreaterThan(0);
    expect(email.html).toContain("<div");
    expect(email.text).not.toContain("<div");
  });

  it("includes the link in both parts", () => {
    const email = renderTaskAssigned(taskInput);
    expect(email.text).toContain(taskInput.taskUrl);
    expect(email.html).toContain(taskInput.taskUrl);
  });

  it("includes optional priority and due date only when given", () => {
    const without = renderTaskAssigned(taskInput);
    expect(without.text).not.toContain("Due:");
    expect(without.text).not.toContain("Priority:");

    const with_ = renderTaskAssigned({
      ...taskInput,
      priority: "HIGH",
      dueDate: "2026-08-20",
    });
    expect(with_.text).toContain("Priority: HIGH");
    expect(with_.text).toContain("Due: 2026-08-20");
  });

  it("escapes a hostile task title in the HTML part", () => {
    const email = renderTaskAssigned({
      ...taskInput,
      taskTitle: '<script>alert("x")</script>',
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("falls back to the email when the actor has no name", () => {
    const email = renderTaskAssigned({
      ...taskInput,
      actor: { name: null, email: "nobody@loanwiser.in" },
    });
    expect(email.html).toContain("nobody@loanwiser.in");
  });
});

describe("renderCommentMention / renderTaskComment", () => {
  const commentInput = { ...taskInput, commentBody: "Please take a look @you" };

  it("names the actor in the mention subject", () => {
    expect(renderCommentMention(commentInput).subject).toContain(
      "Suresh Kumar",
    );
  });

  it("uses different subjects for a mention and a plain comment", () => {
    expect(renderCommentMention(commentInput).subject).not.toBe(
      renderTaskComment(commentInput).subject,
    );
  });

  it("escapes the comment body", () => {
    const email = renderCommentMention({
      ...commentInput,
      commentBody: "<b>bold</b> & <i>italic</i>",
    });
    expect(email.html).not.toContain("<b>bold</b>");
    expect(email.html).toContain("&lt;b&gt;");
  });

  it("truncates a very long comment rather than emailing the whole thing", () => {
    const email = renderTaskComment({
      ...commentInput,
      commentBody: "word ".repeat(500),
    });
    expect(email.text).toContain("…");
    expect(email.text.length).toBeLessThan(1200);
  });
});

describe("shouldNotify", () => {
  const active = { id: "u1", email: "a@loanwiser.in", isActive: true };

  it("notifies an active user about someone else's action", () => {
    expect(shouldNotify(active, "u2")).toBe(true);
  });

  it("never notifies someone about their own action", () => {
    expect(shouldNotify(active, "u1")).toBe(false);
  });

  it("never notifies a deactivated account", () => {
    expect(shouldNotify({ ...active, isActive: false }, "u2")).toBe(false);
  });

  it("never notifies without an email address", () => {
    expect(shouldNotify({ ...active, email: "" }, "u2")).toBe(false);
  });
});

describe("resolveCommentRecipients", () => {
  const alice = { id: "alice", email: "alice@x.com", isActive: true };
  const bob = { id: "bob", email: "bob@x.com", isActive: true };
  const carol = { id: "carol", email: "carol@x.com", isActive: true };

  it("tags mentions and watchers with their reason", () => {
    const result = resolveCommentRecipients({
      actorId: "carol",
      mentioned: [alice],
      watchers: [bob],
    });
    expect(result).toEqual([
      { user: alice, reason: "MENTION" },
      { user: bob, reason: "WATCHER" },
    ]);
  });

  it("emails a mentioned watcher ONCE, as a mention", () => {
    const result = resolveCommentRecipients({
      actorId: "carol",
      mentioned: [alice],
      watchers: [alice, bob],
    });
    expect(result).toHaveLength(2);
    expect(result.filter((r) => r.user.id === "alice")).toEqual([
      { user: alice, reason: "MENTION" },
    ]);
  });

  it("drops the actor from both lists", () => {
    const result = resolveCommentRecipients({
      actorId: "alice",
      mentioned: [alice],
      watchers: [alice],
    });
    expect(result).toEqual([]);
  });

  it("drops deactivated users", () => {
    const result = resolveCommentRecipients({
      actorId: "carol",
      mentioned: [{ ...alice, isActive: false }],
      watchers: [bob],
    });
    expect(result.map((r) => r.user.id)).toEqual(["bob"]);
  });

  it("de-duplicates a watcher listed twice (assignee and reporter)", () => {
    const result = resolveCommentRecipients({
      actorId: "carol",
      mentioned: [],
      watchers: [bob, bob],
    });
    expect(result).toHaveLength(1);
  });

  it("returns nothing when there is nobody to tell", () => {
    expect(
      resolveCommentRecipients({
        actorId: carol.id,
        mentioned: [],
        watchers: [],
      }),
    ).toEqual([]);
  });
});
