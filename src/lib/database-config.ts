/**
 * Database connection built from discrete environment variables.
 *
 *   DB_HOST  DB_PORT  DB_USER  DB_PASS  DB_NAME
 *
 * This matches the convention in the Go services (`fingrid-fas/src/config`,
 * `alpha-api/app/configs`), which read the same five names — so one deployment's
 * SSM parameters look like every other one's.
 *
 * There are two consumers with different needs:
 *
 *  * **The runtime client** takes a config OBJECT (`@prisma/adapter-mariadb`
 *    accepts `mariadb.PoolConfig`), so no URL is built and a password containing
 *    `@`, `:`, `/` or `#` can never corrupt a connection string.
 *  * **The Prisma CLI** (migrate, studio, seed) only understands a URL, so
 *    `buildMysqlUrl` composes one — percent-encoding user and password, which is
 *    exactly the escaping the object form avoids needing.
 *
 * Pure and dependency-free so it can be unit-tested, and so `prisma.config.ts`
 * can import it without pulling in the app.
 */

export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export const DB_DEFAULTS = {
  host: "127.0.0.1",
  port: 3306,
  user: "root",
} as const;

type EnvSource = Record<string, string | undefined>;

/**
 * Read the five variables, applying defaults for everything except the database
 * name — there is no sensible default for *which database*, and silently picking
 * one is how you migrate the wrong schema.
 */
export function databaseConfigFromEnv(
  source: EnvSource = process.env,
): DatabaseConfig {
  const database = (source.DB_NAME ?? "").trim();
  if (!database) {
    throw new Error(
      "DB_NAME is not set. Copy .env.example to .env and set DB_HOST, DB_PORT, DB_USER, DB_PASS and DB_NAME.",
    );
  }

  const rawPort = (source.DB_PORT ?? "").trim();
  const port = rawPort ? Number.parseInt(rawPort, 10) : DB_DEFAULTS.port;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`DB_PORT must be a port number, got "${rawPort}".`);
  }

  return {
    host: (source.DB_HOST ?? "").trim() || DB_DEFAULTS.host,
    port,
    user: (source.DB_USER ?? "").trim() || DB_DEFAULTS.user,
    // An empty password is legitimate on a fresh local MySQL installed with
    // --initialize-insecure, so it is not treated as missing.
    password: source.DB_PASS ?? "",
    database,
  };
}

/**
 * Compose a `mysql://` URL for the Prisma CLI.
 *
 * User and password are percent-encoded: a password like `p@ss:w/rd#1` would
 * otherwise be parsed as a host, a port and a fragment, and the failure looks
 * like a wrong password rather than a quoting bug.
 */
export function buildMysqlUrl(config: DatabaseConfig): string {
  const user = encodeURIComponent(config.user);
  const credentials = config.password
    ? `${user}:${encodeURIComponent(config.password)}`
    : user;

  // The database name travels in the path, so it is path-encoded too.
  return `mysql://${credentials}@${config.host}:${config.port}/${encodeURIComponent(
    config.database,
  )}`;
}

/** Convenience for the CLI: read the env and compose the URL in one call. */
export function databaseUrlFromEnv(source: EnvSource = process.env): string {
  return buildMysqlUrl(databaseConfigFromEnv(source));
}

/** Safe for logs — never includes the password. */
export function describeDatabase(config: DatabaseConfig): string {
  return `${config.user}@${config.host}:${config.port}/${config.database}`;
}
