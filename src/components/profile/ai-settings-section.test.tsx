import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AiSettingsSection } from "./ai-settings-section";
import * as backend from "@/lib/backend";

vi.mock("@/lib/auth", () => ({ getToken: () => "tok" }));
vi.mock("@/lib/backend", () => ({
  getAiSettings: vi.fn(),
  putAiSettings: vi.fn(),
  testAiSettings: vi.fn(),
  refreshSuggestions: vi.fn(),
}));

const mocked = vi.mocked(backend);

function settings(over: Partial<backend.AiSettingsView> = {}) {
  mocked.getAiSettings.mockResolvedValue({
    ok: true,
    status: 200,
    data: { model: "", hasKey: false, lastRun: null, ...over },
  });
}

beforeEach(() => vi.resetAllMocks());

describe("AiSettingsSection", () => {
  it("ohne Key ist das Feld leer", async () => {
    settings();
    render(<AiSettingsSection />);
    const input = await screen.findByLabelText("OpenRouter-Key");
    expect((input as HTMLInputElement).value).toBe("");
    expect(input).toHaveAttribute("type", "password");
  });

  it("mit Key steht Key gespeichert da und kein Key im DOM", async () => {
    settings({ model: "moonshotai/kimi-k3", hasKey: true });
    const { container } = render(<AiSettingsSection />);
    expect(await screen.findByText("Key gespeichert")).toBeTruthy();
    expect(screen.getByText("Ändern")).toBeTruthy();
    expect(screen.queryByLabelText("OpenRouter-Key")).toBeNull();
    expect(container.innerHTML).not.toContain("sk-");
  });

  it("Speichern ohne neue Eingabe schickt keinen apiKey", async () => {
    settings({ model: "moonshotai/kimi-k3", hasKey: true });
    mocked.putAiSettings.mockResolvedValue({ ok: true, status: 200, data: { model: "moonshotai/kimi-k3", hasKey: true } });
    render(<AiSettingsSection />);
    fireEvent.click(await screen.findByText("Speichern"));
    await waitFor(() => expect(mocked.putAiSettings).toHaveBeenCalled());
    expect(mocked.putAiSettings).toHaveBeenCalledWith({ model: "moonshotai/kimi-k3" }, "tok");
  });

  it("Verbindung testen zeigt den Fehlertext", async () => {
    settings({ model: "m", hasKey: true });
    mocked.testAiSettings.mockResolvedValue({ ok: true, status: 200, data: { ok: false, error: "OpenRouter 401: Key ungültig" } });
    render(<AiSettingsSection />);
    fireEvent.click(await screen.findByText("Verbindung testen"));
    expect(await screen.findByText("OpenRouter 401: Key ungültig")).toBeTruthy();
  });

  it("Verbindung testen zeigt Erfolg", async () => {
    settings({ model: "m", hasKey: true });
    mocked.testAiSettings.mockResolvedValue({ ok: true, status: 200, data: { ok: true } });
    render(<AiSettingsSection />);
    fireEvent.click(await screen.findByText("Verbindung testen"));
    expect(await screen.findByText("Verbindung klappt ✓")).toBeTruthy();
  });

  it("Jetzt neu erstellen zeigt bei 429 den Text der API", async () => {
    settings({ model: "m", hasKey: true });
    mocked.refreshSuggestions.mockResolvedValue({ ok: false, status: 429, data: { error: "Bitte warte noch ein paar Minuten." } });
    render(<AiSettingsSection />);
    fireEvent.click(await screen.findByText("Jetzt neu erstellen"));
    expect(await screen.findByText("Bitte warte noch ein paar Minuten.")).toBeTruthy();
  });

  it("fehlgeschlagener letzter Lauf zeigt den Fehler", async () => {
    settings({
      model: "m",
      hasKey: true,
      lastRun: { status: "failed", finishedAt: "2020-01-02T03:10:00.000Z", error: "OpenRouter 401" },
    });
    render(<AiSettingsSection />);
    expect(await screen.findByText(/fehlgeschlagen: OpenRouter 401/)).toBeTruthy();
  });

  it("erfolgreicher Lauf zeigt Zeit mit Haken", async () => {
    settings({ model: "m", hasKey: true, lastRun: { status: "done", finishedAt: new Date().toISOString(), error: null } });
    render(<AiSettingsSection />);
    expect(await screen.findByText(/Letzter Lauf: heute \d\d:\d\d ✓/)).toBeTruthy();
  });
});
