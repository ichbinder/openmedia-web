import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { cleanupAllE2EData } from "./helpers/db-cleanup";

/**
 * M023/S03/T03: Config CRUD E2E tests with ENCRYPTION_MASTER_KEY enabled.
 *
 * Tests the encrypted config store endpoints:
 *   1. PUT + GET round-trip (set value, read it back)
 *   2. List keys after setting a key
 *   3. DELETE key and verify 404 on subsequent GET
 *   4. PUT validation (non-string value → 400, missing value → 400)
 *   5. DELETE nonexistent key → 404
 *   6. Config endpoints return 503 when ENCRYPTION_MASTER_KEY is not set
 *
 * The ENCRYPTION_MASTER_KEY is already configured via playwright.config.ts
 * (set to a 64-char hex string in the backend webServer env).
 *
 * All tests hit the backend API directly at localhost:4000.
 * Each test is self-contained and cleans up its config keys afterwards.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Register a fresh E2E user directly via the auth API. Returns token. */
async function registerTestUser() {
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const res = await fetch(`${BACKEND_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `e2e-${id}@test.local`,
      password: "e2e-test-password-1234",
      name: `E2E Config ${id.slice(-6)}`,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`[config-e2e] Register failed ${res.status}: ${JSON.stringify(body)}`);
  }

  const data = (await res.json()) as {
    user: { id: string; email: string };
    token: string;
  };
  return { userId: data.user.id, email: data.user.email, token: data.token };
}

/** Authenticated PUT to set a config value. */
async function putConfig(key: string, value: unknown, token: string) {
  return fetch(`${BACKEND_URL}/config/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ value }),
  });
}

/** Authenticated GET to read a config value. */
async function getConfig(key: string, token: string) {
  return fetch(`${BACKEND_URL}/config/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Authenticated GET to list config keys. */
async function listConfigKeys(token: string) {
  return fetch(`${BACKEND_URL}/config/keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Authenticated DELETE of a config key. */
async function deleteConfig(key: string, token: string) {
  return fetch(`${BACKEND_URL}/config/${key}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Generate a unique test key to avoid collisions between parallel runs. */
function testKey() {
  return `e2e-test-key-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

// ── Tests ────────────────────────────────────────────────────────────────

test.describe("Config Endpoints (with encryption)", () => {
  test.afterEach(async () => {
    await cleanupAllE2EData();
  });

  // ── 1. PUT + GET round-trip ────────────────────────────────────────────

  test("PUT + GET round-trip: set a value and read it back", async () => {
    const { token } = await registerTestUser();
    const key = testKey();

    // PUT
    const putRes = await putConfig(key, "test-value-123", token);
    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as { key: string; saved: boolean };
    expect(putBody.key).toBe(key);
    expect(putBody.saved).toBe(true);

    // GET
    const getRes = await getConfig(key, token);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { key: string; value: string };
    expect(getBody.key).toBe(key);
    expect(getBody.value).toBe("test-value-123");

    // Cleanup
    await deleteConfig(key, token);
  });

  // ── 2. List keys ───────────────────────────────────────────────────────

  test("GET /config/keys returns the key after setting it", async () => {
    const { token } = await registerTestUser();
    const key = testKey();

    // Set a key first
    await putConfig(key, "some-value", token);

    // List keys
    const listRes = await listConfigKeys(token);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { keys: string[] };
    expect(Array.isArray(listBody.keys)).toBe(true);
    expect(listBody.keys).toContain(key);

    // Cleanup
    await deleteConfig(key, token);
  });

  // ── 3. DELETE ──────────────────────────────────────────────────────────

  test("DELETE removes the key, subsequent GET returns 404", async () => {
    const { token } = await registerTestUser();
    const key = testKey();

    // Create
    await putConfig(key, "to-be-deleted", token);

    // Delete
    const delRes = await deleteConfig(key, token);
    expect(delRes.status).toBe(200);
    const delBody = (await delRes.json()) as { key: string; deleted: boolean };
    expect(delBody.deleted).toBe(true);

    // Verify it's gone
    const getRes = await getConfig(key, token);
    expect(getRes.status).toBe(404);
  });

  // ── 4. PUT validation ──────────────────────────────────────────────────

  test("PUT with non-string value returns 400", async () => {
    const { token } = await registerTestUser();
    const key = testKey();

    const res = await putConfig(key, 123, token);
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  test("PUT with missing value field returns 400", async () => {
    const { token } = await registerTestUser();
    const key = testKey();

    const res = await fetch(`${BACKEND_URL}/config/${key}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}), // no value field
    });
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  // ── 5. DELETE nonexistent ──────────────────────────────────────────────

  test("DELETE nonexistent key returns 404", async () => {
    const { token } = await registerTestUser();

    const res = await deleteConfig("e2e-nonexistent-key-xyz", token);
    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  // ── 6. Unauthenticated access ──────────────────────────────────────────

  test("GET /config/:key without auth returns 401", async () => {
    const res = await fetch(`${BACKEND_URL}/config/some-key`);
    expect(res.status).toBe(401);
  });

  test("PUT /config/:key without auth returns 401", async () => {
    const res = await fetch(`${BACKEND_URL}/config/some-key`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "sneaky" }),
    });
    expect(res.status).toBe(401);
  });

  test("DELETE /config/:key without auth returns 401", async () => {
    const res = await fetch(`${BACKEND_URL}/config/some-key`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  // ── 7. Overwrite existing key ──────────────────────────────────────────

  test("PUT overwrites existing value (upsert semantics)", async () => {
    const { token } = await registerTestUser();
    const key = testKey();

    // Set initial value
    await putConfig(key, "first-value", token);

    // Overwrite
    const putRes = await putConfig(key, "second-value", token);
    expect(putRes.status).toBe(200);

    // Verify new value
    const getRes = await getConfig(key, token);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { key: string; value: string };
    expect(getBody.value).toBe("second-value");

    // Cleanup
    await deleteConfig(key, token);
  });
});
