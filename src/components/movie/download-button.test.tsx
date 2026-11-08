import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DownloadButton } from "./download-button";

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/contexts/download-context", () => ({
  getStatusLabel: (s: string) => s,
  useDownloads: () => ({
    jobs: [],
    startDownload: vi.fn(),
    cancelJob: vi.fn(),
    getLink: vi.fn(),
    checkAvailability,
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const checkAvailability = vi.hoisted(() => vi.fn().mockResolvedValue([]));

const movie = {
  id: 603,
  title: "Matrix",
  poster_path: null,
  vote_average: 8,
  release_date: "1999-03-31",
};

describe("DownloadButton", () => {
  it("shows 'Nicht verfügbar' by default when nothing is available", async () => {
    render(<DownloadButton movie={movie} />);
    expect(await screen.findByText("Nicht verfügbar")).toBeTruthy();
  });

  it("renders nothing with hideWhenUnavailable when nothing is available", async () => {
    const { container } = render(
      <DownloadButton movie={movie} hideWhenUnavailable />,
    );
    await waitFor(() => expect(checkAvailability).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText("Verfügbarkeit prüfen…")).toBeNull(),
    );
    expect(container.querySelector("button")).toBeNull();
  });
});
