/**
 * Make an uploaded file's name safe to store and to echo back in a header.
 *
 * Three things have to go, and only three:
 *
 *  * **Directory parts.** A browser can send `../../etc/passwd`, or a full
 *    Windows path; only the last segment is a file name. This is defence in
 *    depth rather than the control — nothing derives a storage path from this
 *    value, because `buildStorageKey` generates its own opaque key — but a name
 *    that still reads as a path would be echoed into `Content-Disposition`.
 *  * **Control characters.** These are the ones that actually break a header: a
 *    CR or LF in a `Content-Disposition` filename is response splitting.
 *  * **Double quotes**, which would close the quoted string in that same header.
 *
 * Nothing else, and in particular **spaces are kept**. "Q3 budget report.pdf" is
 * the name somebody chose and the name they expect back when they download it.
 *
 * The previous version stripped them, because it was written `/[ -"]/` — a
 * character RANGE from 0x20 to 0x22, not the set it reads as. It deleted space,
 * `!` and `"`, and left every real control character in place: the opposite of
 * the job in both directions. Written as explicit escapes here so the range is
 * unmistakable to the next reader.
 *
 * Pure and prisma-free so it is unit-testable — see the note in AGENTS.md. It
 * used to live in `attachment.service.ts`, where a Prisma import at module scope
 * meant it could not be covered at all.
 */

/** C0 controls, DEL, and the quote that delimits a header parameter. */
const UNSAFE_IN_FILE_NAME = /[\u0000-\u001f\u007f"]/g;

export function sanitizeFileName(raw: string): string {
  const base = (raw || "file").split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(UNSAFE_IN_FILE_NAME, "").trim();

  // A name that was entirely unsafe, or entirely whitespace, still has to be
  // something. Truncation comes last, so the limit applies to what is kept.
  return (cleaned || "file").slice(0, 255);
}
