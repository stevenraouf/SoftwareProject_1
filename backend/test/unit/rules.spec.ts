import { BadRequestException } from "@nestjs/common";
import {
  dateOnly,
  localInstant,
  minor,
  money,
  nights,
  overlaps,
  refundPercent,
} from "../../src/common.js";
import { passwordHash, passwordMatches } from "../../src/auth/auth.js";
import { validateImage } from "../../src/media/media.js";
import { PNG } from "pngjs";

describe("Business rules and safe primitives", () => {
  test("hotel dates use a half-open range, including leap days", () => {
    expect(nights("2028-02-28", "2028-03-01")).toEqual([
      "2028-02-28",
      "2028-02-29",
    ]);
    expect(
      overlaps(
        { start: "2028-01-01", end: "2028-01-03" },
        { start: "2028-01-03", end: "2028-01-04" },
      ),
    ).toBe(false);
    expect(() => nights("2028-01-03", "2028-01-03")).toThrow(
      BadRequestException,
    );
    expect(() => dateOnly("2027-02-29")).toThrow(BadRequestException);
  });
  test("refund tiers choose the highest eligible threshold and preserve zero", () => {
    const tiers = [
      { threshold: 7, refundPercent: 90 },
      { threshold: 0, refundPercent: 0 },
      { threshold: 2, refundPercent: 50 },
    ];
    expect(refundPercent(tiers, 8)).toBe(90);
    expect(refundPercent(tiers, 7)).toBe(90);
    expect(refundPercent(tiers, 6)).toBe(50);
    expect(refundPercent(tiers, 1)).toBe(0);
    expect(refundPercent([], 10)).toBe(0);
  });
  test("airport-local inputs convert to UTC and reject nonexistent DST times", () => {
    expect(localInstant("2028-01-10T10:00", "Asia/Dubai").toISOString()).toBe(
      "2028-01-10T06:00:00.000Z",
    );
    expect(() =>
      localInstant("2028-03-12T02:30", "America/New_York"),
    ).toThrow();
    expect(() =>
      localInstant("2028-11-05T01:30", "America/New_York"),
    ).toThrow();
    expect(() => localInstant("2028-01-10T10:00Z", "Asia/Dubai")).toThrow();
  });
  test("monetary boundaries use two decimal places and integer minor units", () => {
    expect(money(1.005)).toBe(1.01);
    expect(minor(10.99)).toBe(1099);
    expect(minor(0)).toBe(0);
  });
  test("salted password hashes differ and verify without plaintext storage", async () => {
    const a = await passwordHash("Password123"),
      b = await passwordHash("Password123");
    expect(a).not.toBe(b);
    expect(a).not.toContain("Password123");
    expect(await passwordMatches("Password123", a)).toBe(true);
    expect(await passwordMatches("wrong", a)).toBe(false);
  });
  test("image validation decodes content, rejects spoofed MIME and corrupt data", () => {
    const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
    expect(validateImage(png, "image/png").ext).toBe("png");
    expect(() => validateImage(png, "image/jpeg")).toThrow();
    expect(() =>
      validateImage(Buffer.from("not an image"), "image/png"),
    ).toThrow();
    expect(() => validateImage(png.subarray(0, 12), "image/png")).toThrow();
    expect(() =>
      validateImage(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png"),
    ).toThrow();
  });
});
