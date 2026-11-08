import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ShowPreviewActions } from "./show-preview-actions";
import type { PreviewData } from "@/app/actions/preview";

const mockPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock("@/lib/auth", () => ({ getToken: vi.fn(() => "tok") }));
vi.mock("@/lib/backend", () => ({
  getNzbShowByTmdb: vi.fn(),
  requestEpisodes: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { getToken } from "@/lib/auth";
import { getNzbShowByTmdb, requestEpisodes } from "@/lib/backend";
const mockGetShow = vi.mocked(getNzbShowByTmdb);
const mockRequest = vi.mocked(requestEpisodes);
const mockToken = vi.mocked(getToken);

const data = {
  seasons: [{ season_number: 1, episode_count: 10 }],
  lastAired: { season: 1, episode: 5 },
} as PreviewData;

const library = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ season: 1, episode: i + 1 }));

function showResponse(myLibrary: unknown[], myRequests: unknown[] = []) {
  return { ok: true, status: 200, data: { show: {}, myLibrary, myRequests } } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockToken.mockReturnValue("tok");
  mockGetShow.mockResolvedValue({ ok: false, status: 404, data: null as never });
});

describe("ShowPreviewActions", () => {
  it("starts at S1E1 on 404 without an error toast", async () => {
    render(<ShowPreviewActions showId={7} data={data} />);
    await screen.findByText("Nächste: Staffel 1, Folge 1");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("requests the next episode and disables the button afterwards", async () => {
    mockGetShow.mockResolvedValue(showResponse(library(3)));
    mockRequest.mockResolvedValue({ ok: true, data: { requests: [{}] } } as never);
    render(<ShowPreviewActions showId={7} data={data} />);
    await screen.findByText("Nächste: Staffel 1, Folge 4");
    fireEvent.click(screen.getByText("Herunterladen"));
    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith(
        { tmdbId: 7, season: 1, episode: 4 },
        "tok",
      ),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const button = screen.getByText("Herunterladen").closest("button");
    expect(button?.disabled).toBe(true);
    fireEvent.click(button!);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("shows the error message from a failed request", async () => {
    mockRequest.mockResolvedValue({ ok: false, data: { error: "kaputt" } } as never);
    render(<ShowPreviewActions showId={7} data={data} />);
    await screen.findByText("Nächste: Staffel 1, Folge 1");
    fireEvent.click(screen.getByText("Herunterladen"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("kaputt"));
  });

  it("ignores expired requests", async () => {
    mockGetShow.mockResolvedValue(
      showResponse(library(3), [{ season: 1, episode: 4, status: "expired" }]),
    );
    render(<ShowPreviewActions showId={7} data={data} />);
    await screen.findByText("Nächste: Staffel 1, Folge 4");
  });

  it("tolerates an older API without myLibrary", async () => {
    mockGetShow.mockResolvedValue(showResponse(undefined as never));
    render(<ShowPreviewActions showId={7} data={data} />);
    await screen.findByText("Nächste: Staffel 1, Folge 1");
  });

  it("counts open requests as present", async () => {
    mockGetShow.mockResolvedValue(
      showResponse(library(3), [{ season: 1, episode: 4, status: "searching" }]),
    );
    render(<ShowPreviewActions showId={7} data={data} />);
    await screen.findByText("Nächste: Staffel 1, Folge 5");
  });

  it("shows 'Alles da' without download button when up to date", async () => {
    mockGetShow.mockResolvedValue(showResponse(library(5)));
    render(<ShowPreviewActions showId={7} data={data} />);
    await screen.findByText("Alles da");
    expect(screen.queryByText("Herunterladen")).toBeNull();
  });

  it("sends logged-out users to /login without calling the API", () => {
    mockToken.mockReturnValue(null);
    render(<ShowPreviewActions showId={7} data={data} />);
    expect(mockGetShow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Herunterladen"));
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("shows only 'Mehr' when the lookup fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetShow.mockResolvedValue({ ok: false, status: 500, data: null as never });
    render(<ShowPreviewActions showId={7} data={data} />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(screen.queryByText("Herunterladen")).toBeNull();
    expect(screen.queryByText(/Nächste/)).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("shows only 'Mehr' without preview data", () => {
    render(<ShowPreviewActions showId={7} data={null} />);
    expect(screen.queryByText("Herunterladen")).toBeNull();
    expect(screen.getByText("Mehr").closest("a")?.getAttribute("href")).toBe("/serie/7");
  });
});
