import { describe, expect, it } from "vitest";

import { sanitizeFileName } from "@/lib/file-name";

describe("sanitizeFileName", () => {
  // The regression this module was extracted for. `/[ -"]/` is a RANGE from
  // 0x20 to 0x22, so the old version deleted every space in every uploaded
  // file's name — and left the control characters it was written to remove.
  it("keeps spaces", () => {
    expect(sanitizeFileName("Q3 budget report.pdf")).toBe(
      "Q3 budget report.pdf",
    );
  });

  it("keeps the punctuation the old range ate", () => {
    expect(sanitizeFileName("release notes!.md")).toBe("release notes!.md");
  });

  it("strips control characters", () => {
    // A CR or LF here is response splitting in Content-Disposition.
    expect(sanitizeFileName("in\r\nvoice.pdf")).toBe("invoice.pdf");
    expect(sanitizeFileName("a\u0000b\u001fc\u007f.txt")).toBe("abc.txt");
  });

  it("strips the quote that would close a header parameter", () => {
    expect(sanitizeFileName('sales "final".xlsx')).toBe("sales final.xlsx");
  });

  it("keeps only the last path segment", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\sam\\notes.txt")).toBe("notes.txt");
    expect(sanitizeFileName("folder/sub/report.csv")).toBe("report.csv");
  });

  it("falls back rather than returning an empty name", () => {
    expect(sanitizeFileName("")).toBe("file");
    expect(sanitizeFileName("   ")).toBe("file");
    expect(sanitizeFileName("\u0000\u0001")).toBe("file");
    // A path with nothing after the last separator.
    expect(sanitizeFileName("folder/")).toBe("file");
  });

  it("caps the length after cleaning, not before", () => {
    const name = `${"a".repeat(300)}.pdf`;
    expect(sanitizeFileName(name)).toHaveLength(255);

    // 260 real characters once the controls are gone, so the cap still bites
    // on what was kept rather than on what was thrown away.
    const noisy = "b".repeat(260).split("").join("\u0007");
    expect(sanitizeFileName(noisy)).toBe("b".repeat(255));
  });

  it("leaves unicode alone", () => {
    expect(sanitizeFileName("données café.pdf")).toBe("données café.pdf");
  });
});
