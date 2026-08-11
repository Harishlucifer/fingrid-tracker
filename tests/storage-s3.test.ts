/**
 * S3 driver construction.
 *
 * A misconfigured server must fail at BOOT, not on the first upload — otherwise
 * the failure surfaces as a broken attachment months later, on the one request
 * that mattered. These tests pin that behaviour.
 *
 * No network: the AWS SDK is imported lazily inside the driver's methods, so
 * constructing it touches nothing.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createS3Storage } from "@/server/storage/s3";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.STORAGE_DRIVER = "s3";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("createS3Storage", () => {
  it("throws immediately when S3_BUCKET is missing", () => {
    delete process.env.S3_BUCKET;
    expect(() => createS3Storage()).toThrow(/S3_BUCKET must be set/);
  });

  it("constructs with a bucket, without touching the network", () => {
    process.env.S3_BUCKET = "inforvio-pm-attachments";
    const storage = createS3Storage();
    expect(typeof storage.put).toBe("function");
    expect(typeof storage.get).toBe("function");
    expect(typeof storage.delete).toBe("function");
  });

  it("does not require a region to be set explicitly", () => {
    process.env.S3_BUCKET = "inforvio-pm-attachments";
    delete process.env.S3_REGION;
    delete process.env.AWS_REGION;
    // Falls back to the documented default rather than failing.
    expect(() => createS3Storage()).not.toThrow();
  });

  it("accepts an optional prefix and endpoint without complaint", () => {
    process.env.S3_BUCKET = "inforvio-pm-attachments";
    process.env.S3_PREFIX = "/staging/";
    process.env.S3_ENDPOINT = "http://localhost:9000";
    expect(() => createS3Storage()).not.toThrow();
  });
});
