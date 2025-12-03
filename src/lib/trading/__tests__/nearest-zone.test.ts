import assert from "node:assert/strict";
import test from "node:test";
import { computeNearestZoneInfo } from "../nearest-zone";
import type { OcZone } from "../types";

const baseZone: OcZone = {
  zone_low: 95,
  zone_high: 105,
  zone_mid: 100,
  score: 1,
};

function assertStatus(
  spot: number,
  atr20: number | null,
  expectedStatus: "AT_ZONE" | "NEAR" | "FAR",
  message: string,
) {
  const info = computeNearestZoneInfo([baseZone], spot, atr20);
  assert.ok(info, `${message} (expected non-null info)`);
  assert.equal(
    info!.status,
    expectedStatus,
    `${message} (expected ${expectedStatus}, got ${info!.status})`,
  );
}

test("ATR-based: prices within 0.1 ATR are AT_ZONE", () => {
  assertStatus(100, 10, "AT_ZONE", "spot exactly at mid should be AT_ZONE");
});

test("ATR-based: prices within 0.25 ATR are NEAR", () => {
  assertStatus(102, 10, "NEAR", "spot 2 away with ATR 10 should be NEAR");
});

test("ATR-based: prices beyond 0.25 ATR are FAR", () => {
  assertStatus(105, 10, "FAR", "spot 5 away with ATR 10 should be FAR");
});

test("Percent-only: prices within 0.1% are AT_ZONE", () => {
  assertStatus(100, null, "AT_ZONE", "spot exactly at mid should be AT_ZONE");
});

test("Percent-only: prices within 0.5% are NEAR", () => {
  assertStatus(100.3, null, "NEAR", "0.3% distance should be NEAR");
});

test("Percent-only: prices beyond 0.5% are FAR", () => {
  assertStatus(101, null, "FAR", "1% distance should be FAR");
});
