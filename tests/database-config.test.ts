/**
 * Database config assembly.
 *
 * The escaping tests are the point of this file: a password containing `@`, `:`,
 * `/` or `#` silently produces a *valid but wrong* URL, and the resulting failure
 * looks like bad credentials rather than a quoting bug. The runtime path avoids
 * URLs entirely for this reason; the CLI path has to encode.
 */

import { describe, expect, it } from "vitest";

import {
  buildMysqlUrl,
  databaseConfigFromEnv,
  databaseUrlFromEnv,
  describeDatabase,
  DB_DEFAULTS,
} from "@/lib/database-config";

describe("databaseConfigFromEnv", () => {
  it("reads all five values", () => {
    expect(
      databaseConfigFromEnv({
        DB_HOST: "db.internal",
        DB_PORT: "3307",
        DB_USER: "pm_app",
        DB_PASS: "secret",
        DB_NAME: "inforvio_pm",
      }),
    ).toEqual({
      host: "db.internal",
      port: 3307,
      user: "pm_app",
      password: "secret",
      database: "inforvio_pm",
    });
  });

  it("applies defaults for everything except the database name", () => {
    expect(databaseConfigFromEnv({ DB_NAME: "inforvio_pm" })).toEqual({
      host: DB_DEFAULTS.host,
      port: DB_DEFAULTS.port,
      user: DB_DEFAULTS.user,
      password: "",
      database: "inforvio_pm",
    });
  });

  it("throws a directive error when DB_NAME is missing or blank", () => {
    expect(() => databaseConfigFromEnv({})).toThrow(/DB_NAME/);
    expect(() => databaseConfigFromEnv({ DB_NAME: "   " })).toThrow(/DB_NAME/);
  });

  it("accepts an empty password — valid on a fresh local MySQL", () => {
    const config = databaseConfigFromEnv({ DB_NAME: "x", DB_PASS: "" });
    expect(config.password).toBe("");
  });

  it("trims surrounding whitespace", () => {
    const config = databaseConfigFromEnv({
      DB_HOST: "  db.internal  ",
      DB_NAME: "  inforvio_pm  ",
      DB_USER: "  pm_app  ",
    });
    expect(config.host).toBe("db.internal");
    expect(config.database).toBe("inforvio_pm");
    expect(config.user).toBe("pm_app");
  });

  it("falls back to the default port when DB_PORT is blank", () => {
    expect(databaseConfigFromEnv({ DB_NAME: "x", DB_PORT: "" }).port).toBe(3306);
  });

  it("rejects a nonsense or out-of-range port instead of coercing it", () => {
    for (const port of ["abc", "0", "-1", "70000"]) {
      expect(
        () => databaseConfigFromEnv({ DB_NAME: "x", DB_PORT: port }),
        port,
      ).toThrow(/DB_PORT/);
    }
  });
});

describe("buildMysqlUrl", () => {
  const base = {
    host: "127.0.0.1",
    port: 3306,
    user: "root",
    password: "",
    database: "inforvio_pm",
  };

  it("omits the colon entirely when there is no password", () => {
    expect(buildMysqlUrl(base)).toBe("mysql://root@127.0.0.1:3306/inforvio_pm");
  });

  it("includes a simple password", () => {
    expect(buildMysqlUrl({ ...base, password: "hunter2" })).toBe(
      "mysql://root:hunter2@127.0.0.1:3306/inforvio_pm",
    );
  });

  it("percent-encodes the characters that would break the URL", () => {
    const url = buildMysqlUrl({ ...base, password: "p@ss:w/rd#1?x" });
    // The host must still parse as the real host, not as part of the password.
    expect(new URL(url).hostname).toBe("127.0.0.1");
    expect(new URL(url).port).toBe("3306");
    expect(url).not.toContain("p@ss");
    // And it must round-trip back to the original secret.
    expect(decodeURIComponent(new URL(url).password)).toBe("p@ss:w/rd#1?x");
  });

  it("encodes a username containing an @", () => {
    const url = buildMysqlUrl({ ...base, user: "admin@corp", password: "x" });
    expect(new URL(url).hostname).toBe("127.0.0.1");
    expect(decodeURIComponent(new URL(url).username)).toBe("admin@corp");
  });

  it("produces a URL whose path is the database name", () => {
    const url = new URL(buildMysqlUrl(base));
    expect(url.pathname).toBe("/inforvio_pm");
  });

  it("round-trips through databaseUrlFromEnv", () => {
    const url = databaseUrlFromEnv({
      DB_HOST: "db.internal",
      DB_PORT: "3307",
      DB_USER: "pm_app",
      DB_PASS: "a:b@c",
      DB_NAME: "pm",
    });
    const parsed = new URL(url);
    expect(parsed.protocol).toBe("mysql:");
    expect(parsed.hostname).toBe("db.internal");
    expect(parsed.port).toBe("3307");
    expect(decodeURIComponent(parsed.password)).toBe("a:b@c");
  });
});

describe("describeDatabase", () => {
  it("never includes the password", () => {
    const description = describeDatabase({
      host: "db.internal",
      port: 3306,
      user: "pm_app",
      password: "topsecret",
      database: "pm",
    });
    expect(description).toBe("pm_app@db.internal:3306/pm");
    expect(description).not.toContain("topsecret");
  });
});
