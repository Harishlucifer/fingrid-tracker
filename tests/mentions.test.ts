import { describe, expect, it } from "vitest";

import { parseMentionEmails } from "@/lib/mentions";

describe("parseMentionEmails", () => {
  it("extracts a single mention", () => {
    expect(parseMentionEmails("hey @suresh@inforvio.com can you look?")).toEqual([
      "suresh@inforvio.com",
    ]);
  });

  it("extracts several and lowercases them", () => {
    expect(
      parseMentionEmails("@A@inforvio.com and @b@Partner.co.uk please review"),
    ).toEqual(["a@inforvio.com", "b@partner.co.uk"]);
  });

  it("de-duplicates repeats", () => {
    expect(
      parseMentionEmails("@a@inforvio.com @a@inforvio.com @A@INFORVIO.COM"),
    ).toEqual(["a@inforvio.com"]);
  });

  it("ignores plain emails with no @ prefix", () => {
    expect(parseMentionEmails("contact suresh@inforvio.com for access")).toEqual(
      [],
    );
  });

  it("returns nothing for text without mentions", () => {
    expect(parseMentionEmails("no mentions here")).toEqual([]);
    expect(parseMentionEmails("")).toEqual([]);
    expect(parseMentionEmails("@notanemail")).toEqual([]);
  });

  it("handles a mention at the very start and end", () => {
    expect(parseMentionEmails("@a@b.com")).toEqual(["a@b.com"]);
    expect(parseMentionEmails("ping @a@b.com")).toEqual(["a@b.com"]);
  });
});
