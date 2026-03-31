import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerUser, loginUser, logoutUser, getCurrentUser } from "@/lib/auth";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("Auth Module", () => {
  describe("registerUser", () => {
    it("gibt User bei erfolgreicher Registrierung", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: "1", email: "test@test.de", name: "Test" },
          token: "jwt-token",
        }),
      });

      const result = await registerUser({ email: "test@test.de", password: "123456", name: "Test" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.email).toBe("test@test.de");
      }

      expect(mockFetch).toHaveBeenCalledWith("/api/backend/auth/register", expect.objectContaining({
        method: "POST",
      }));
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
    it("gibt User bei erfolgreichem Login", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: "1", email: "test@test.de", name: "Test" },
          token: "jwt-token",
        }),
      });

      const result = await loginUser({ email: "test@test.de", password: "123456" });

      expect(result.success).toBe(true);
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
    it("ruft Logout-Endpoint auf", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await logoutUser();

      expect(mockFetch).toHaveBeenCalledWith("/api/backend/auth/logout", expect.objectContaining({
        method: "POST",
      }));
    });

    it("fängt Netzwerk-Fehler ab", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Should not throw
      await expect(logoutUser()).resolves.not.toThrow();
    });
  });

  describe("getCurrentUser", () => {
    it("gibt User bei gültiger Session", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: "1", email: "test@test.de", name: "Test" } }),
      });

      const user = await getCurrentUser();
      expect(user).toMatchObject({ email: "test@test.de" });
    });

    it("gibt null bei ungültiger Session", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Unauthorized" }) });

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it("gibt null bei Netzwerk-Fehler", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });
});
