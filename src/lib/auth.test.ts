import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerUser, loginUser, logoutUser, getCurrentUser } from "@/lib/auth";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock localStorage
const storage: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => { storage[key] = val; },
  removeItem: (key: string) => { delete storage[key]; },
});

beforeEach(() => {
  mockFetch.mockReset();
  Object.keys(storage).forEach((k) => delete storage[k]);
});

describe("Auth Module", () => {
  describe("registerUser", () => {
    it("gibt User und Token bei erfolgreicher Registrierung", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: "1", email: "test@test.de", name: "Test" },
          token: "jwt-token-123",
        }),
      });

      const result = await registerUser({ email: "test@test.de", password: "123456", name: "Test" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.email).toBe("test@test.de");
        expect(result.token).toBe("jwt-token-123");
      }

      expect(mockFetch).toHaveBeenCalledWith("/api/backend/auth/register", expect.objectContaining({
        method: "POST",
      }));

      // Token should be stored in localStorage
      expect(storage["openmedia_token"]).toBe("jwt-token-123");
    });

    it("gibt Fehler bei API-Fehler", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "E-Mail existiert bereits." }),
      });

      const result = await registerUser({ email: "test@test.de", password: "123456", name: "Test" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("E-Mail existiert bereits.");
      }
    });

    it("gibt Netzwerk-Fehler", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await registerUser({ email: "test@test.de", password: "123456", name: "Test" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Verbindung");
      }
    });
  });

  describe("loginUser", () => {
    it("gibt User bei erfolgreichem Login und speichert Token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: "1", email: "test@test.de", name: "Test" },
          token: "jwt-login-token",
        }),
      });

      const result = await loginUser({ email: "test@test.de", password: "123456" });

      expect(result.success).toBe(true);
      expect(storage["openmedia_token"]).toBe("jwt-login-token");
    });

    it("gibt Fehler bei falschen Credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "E-Mail oder Passwort ist falsch." }),
      });

      const result = await loginUser({ email: "test@test.de", password: "wrong" });

      expect(result.success).toBe(false);
    });
  });

  describe("logoutUser", () => {
    it("löscht Token aus localStorage", async () => {
      storage["openmedia_token"] = "some-token";

      await logoutUser();

      expect(storage["openmedia_token"]).toBeUndefined();
    });
  });

  describe("getCurrentUser", () => {
    it("gibt SessionResult mit User bei gültigem Token", async () => {
      storage["openmedia_token"] = "valid-token";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: { id: "1", email: "test@test.de", name: "Test" } }),
      });

      const result = await getCurrentUser();
      expect(result.user).toMatchObject({ email: "test@test.de" });
      expect(result.wasRejected).toBe(false);

      // Should send Authorization header
      expect(mockFetch).toHaveBeenCalledWith("/api/backend/auth/me", expect.objectContaining({
        headers: { Authorization: "Bearer valid-token" },
      }));
    });

    it("gibt SessionResult mit user=null und wasRejected=false ohne Token wenn /me leer antwortet", async () => {
      // Without a token the proxy still calls /me (which may use a httpOnly cookie).
      // If the response is 200 with user=null, that's a clean "no session" outcome.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: null }),
      });

      const result = await getCurrentUser();
      expect(result.user).toBeNull();
      expect(result.wasRejected).toBe(false);

      // Verify /me is still called even without a token (httpOnly cookie fallback)
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/backend/auth/me",
        expect.objectContaining({ headers: {} }),
      );
    });

    it("löscht Token und setzt wasRejected=true bei 401", async () => {
      storage["openmedia_token"] = "expired-token";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      });

      const result = await getCurrentUser();
      expect(result.user).toBeNull();
      expect(result.wasRejected).toBe(true);
      expect(storage["openmedia_token"]).toBeUndefined();
    });

    it("gibt user=null und wasRejected=false bei Netzwerk-Fehler", async () => {
      storage["openmedia_token"] = "some-token";
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await getCurrentUser();
      expect(result.user).toBeNull();
      expect(result.wasRejected).toBe(false);
    });
  });
});
