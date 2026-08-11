/**
 * Per-service AWS credential resolution.
 *
 * Two things matter here and both fail silently if wrong:
 *
 *  * A service-specific key must WIN over the shared one, or configuring a
 *    separate SES key would appear to work while still using the S3 key.
 *  * A half-configured pair must ERROR rather than fall through to the next
 *    level — a mistyped `SES_SECRET_ACCESS_KEY` silently dropping to a shared key
 *    or an instance role means mail sends from an identity nobody intended.
 */

import { describe, expect, it } from "vitest";

import {
  describeCredentialOrigin,
  formatCredentialOrigin,
  resolveAwsCredentials,
} from "@/lib/aws-credentials";

const SHARED = {
  AWS_ACCESS_KEY_ID: "AKIASHARED",
  AWS_SECRET_ACCESS_KEY: "shared-secret",
};

describe("resolveAwsCredentials — service-specific keys", () => {
  it("uses the S3 key for S3", () => {
    expect(
      resolveAwsCredentials("S3", {
        S3_ACCESS_KEY_ID: "AKIAS3",
        S3_SECRET_ACCESS_KEY: "s3-secret",
      }),
    ).toEqual({ accessKeyId: "AKIAS3", secretAccessKey: "s3-secret" });
  });

  it("uses the SES key for SES", () => {
    expect(
      resolveAwsCredentials("SES", {
        SES_ACCESS_KEY_ID: "AKIASES",
        SES_SECRET_ACCESS_KEY: "ses-secret",
      }),
    ).toEqual({ accessKeyId: "AKIASES", secretAccessKey: "ses-secret" });
  });

  it("keeps the two services independent when both are configured", () => {
    const source = {
      S3_ACCESS_KEY_ID: "AKIAS3",
      S3_SECRET_ACCESS_KEY: "s3-secret",
      SES_ACCESS_KEY_ID: "AKIASES",
      SES_SECRET_ACCESS_KEY: "ses-secret",
    };
    expect(resolveAwsCredentials("S3", source)?.accessKeyId).toBe("AKIAS3");
    expect(resolveAwsCredentials("SES", source)?.accessKeyId).toBe("AKIASES");
  });

  it("does NOT let the S3 key leak into SES", () => {
    const source = {
      S3_ACCESS_KEY_ID: "AKIAS3",
      S3_SECRET_ACCESS_KEY: "s3-secret",
    };
    expect(resolveAwsCredentials("SES", source)).toBeUndefined();
  });

  it("a service key overrides the shared key", () => {
    expect(
      resolveAwsCredentials("SES", {
        ...SHARED,
        SES_ACCESS_KEY_ID: "AKIASES",
        SES_SECRET_ACCESS_KEY: "ses-secret",
      })?.accessKeyId,
    ).toBe("AKIASES");
  });

  it("supports a service session token for temporary credentials", () => {
    expect(
      resolveAwsCredentials("S3", {
        S3_ACCESS_KEY_ID: "ASIAS3",
        S3_SECRET_ACCESS_KEY: "s",
        S3_SESSION_TOKEN: "t",
      }),
    ).toEqual({
      accessKeyId: "ASIAS3",
      secretAccessKey: "s",
      sessionToken: "t",
    });
  });
});

describe("resolveAwsCredentials — shared fallback", () => {
  it("falls back to the shared key when no service key is set", () => {
    expect(resolveAwsCredentials("S3", SHARED)?.accessKeyId).toBe("AKIASHARED");
    expect(resolveAwsCredentials("SES", SHARED)?.accessKeyId).toBe("AKIASHARED");
  });

  it("returns undefined when nothing is set, deferring to the IAM role", () => {
    expect(resolveAwsCredentials("S3", {})).toBeUndefined();
    expect(
      resolveAwsCredentials("SES", {
        SES_ACCESS_KEY_ID: "",
        AWS_ACCESS_KEY_ID: "   ",
      }),
    ).toBeUndefined();
  });

  it("trims whitespace that copy-paste adds", () => {
    expect(
      resolveAwsCredentials("S3", {
        S3_ACCESS_KEY_ID: "  AKIAS3  ",
        S3_SECRET_ACCESS_KEY: "  s3-secret  ",
      }),
    ).toEqual({ accessKeyId: "AKIAS3", secretAccessKey: "s3-secret" });
  });
});

describe("resolveAwsCredentials — half-configured pairs", () => {
  it("throws naming the missing service variable", () => {
    expect(() =>
      resolveAwsCredentials("SES", { SES_ACCESS_KEY_ID: "AKIASES" }),
    ).toThrow(/SES_SECRET_ACCESS_KEY/);

    expect(() =>
      resolveAwsCredentials("S3", { S3_SECRET_ACCESS_KEY: "s" }),
    ).toThrow(/S3_ACCESS_KEY_ID/);
  });

  it("throws naming the missing shared variable", () => {
    expect(() =>
      resolveAwsCredentials("S3", { AWS_ACCESS_KEY_ID: "AKIASHARED" }),
    ).toThrow(/AWS_SECRET_ACCESS_KEY/);
  });

  it("does NOT fall back to the shared key when the service pair is half set", () => {
    // The dangerous case: a typo must not silently use a different identity.
    expect(() =>
      resolveAwsCredentials("SES", { ...SHARED, SES_ACCESS_KEY_ID: "AKIASES" }),
    ).toThrow(/SES_SECRET_ACCESS_KEY/);
  });
});

describe("credential origin reporting", () => {
  it("reports a service key without revealing the secret", () => {
    const origin = describeCredentialOrigin("SES", {
      SES_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
      SES_SECRET_ACCESS_KEY: "wJalrXUtnFEMI",
    });
    const text = formatCredentialOrigin(origin);
    expect(text).toContain("SES-specific");
    expect(text).toContain("MPLE");
    expect(text).not.toContain("wJalrXUtnFEMI");
  });

  it("distinguishes shared from service-specific", () => {
    expect(formatCredentialOrigin(describeCredentialOrigin("S3", SHARED))).toMatch(
      /shared AWS key/,
    );
  });

  it("reports the default chain when nothing is configured", () => {
    expect(formatCredentialOrigin(describeCredentialOrigin("S3", {}))).toMatch(
      /default provider chain/,
    );
  });

  it("flags temporary credentials", () => {
    expect(
      formatCredentialOrigin(
        describeCredentialOrigin("S3", {
          S3_ACCESS_KEY_ID: "ASIAX",
          S3_SECRET_ACCESS_KEY: "s",
          S3_SESSION_TOKEN: "t",
        }),
      ),
    ).toMatch(/temporary/);
  });
});
