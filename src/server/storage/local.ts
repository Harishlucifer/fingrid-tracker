/**
 * Local-filesystem storage driver.
 *
 * Files land under STORAGE_LOCAL_DIR (default ./var/uploads), which is gitignored
 * and deliberately NOT inside public/ — anything in public/ is served
 * unauthenticated by Next, so a guessed URL would hand out an attachment. The
 * only way out of this directory is the download route, which authorizes first.
 */

import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { assertSafeKey, type PutResult, type Storage } from "./index";

export function createLocalStorage(rootDir: string): Storage {
  // turbopackIgnore: the storage root is configuration-driven, so the bundler
  // cannot statically scope it and would otherwise trace the entire project
  // into the server output. Containment is enforced at runtime below instead.
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), rootDir);

  /** Resolve a key inside the root, refusing anything that escapes it. */
  function resolveKey(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(/* turbopackIgnore: true */ root, key);
    // Even with a validated key, confirm containment after resolution — this is
    // the check that actually holds if the validation above is ever loosened.
    if (full !== root && !full.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Storage key escapes the root: ${key}`);
    }
    return full;
  }

  return {
    async put(key, body): Promise<PutResult> {
      const full = resolveKey(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
      return { key, size: body.byteLength };
    },

    async get(key): Promise<ReadableStream<Uint8Array>> {
      const full = resolveKey(key);
      // Node stream -> web stream, so the route handler can return it directly.
      return Readable.toWeb(
        createReadStream(full),
      ) as ReadableStream<Uint8Array>;
    },

    async delete(key): Promise<void> {
      const full = resolveKey(key);
      await rm(full, { force: true });
    },
  };
}
