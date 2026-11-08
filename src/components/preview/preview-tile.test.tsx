import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { PreviewData } from "@/app/actions/preview";
import { getPreview } from "@/app/actions/preview";
import { PreviewTile } from "./preview-tile";

vi.mock("@/app/actions/preview", () => ({ getPreview: vi.fn() }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const mockedGetPreview = vi.mocked(getPreview);

const data: PreviewData = {
  trailerKey: "abc123",
  backdropPath: "/b.jpg",
  overview: "Ein Kind verschwindet.",
  genres: ["Krimi", "Mystery"],
  numberOfSeasons: 3,
  seasons: [],
  lastAired: null,
};

function renderTile(id: number, kind: "movie" | "tv" = "tv") {
  render(
    <PreviewTile
      kind={kind}
      id={id}
      title="Dark"
      voteAverage={8.4}
      year="2017"
      actions={() => <button>Merken</button>}
    >
      <div>Kachel</div>
    </PreviewTile>,
  );
  return screen.getByText("Kachel");
}

async function hover(tile: HTMLElement, ms = 1000) {
  fireEvent.mouseEnter(tile);
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

describe("PreviewTile", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedGetPreview.mockReset();
    mockedGetPreview.mockResolvedValue(data);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens the preview after 1000 ms of hovering", async () => {
    const tile = renderTile(1);
    await hover(tile, 999);
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole("dialog", { name: "Dark" })).toBeTruthy();
    expect(screen.getByText("★ 8.4")).toBeTruthy();
    expect(screen.getByText(/3 Staffeln/)).toBeTruthy();
    expect(screen.getByText("Ein Kind verschwindet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Merken" })).toBeTruthy();
  });

  it("does not open or fetch when the mouse leaves early", async () => {
    const tile = renderTile(2);
    await hover(tile, 500);
    fireEvent.mouseLeave(tile);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockedGetPreview).not.toHaveBeenCalled();
  });

  it("fetches the preview data only once per tile", async () => {
    const tile = renderTile(3);
    await hover(tile);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await hover(tile);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mockedGetPreview).toHaveBeenCalledTimes(1);
    expect(mockedGetPreview).toHaveBeenCalledWith("tv", 3);
  });

  it("shows the backdrop when there is no trailer", async () => {
    mockedGetPreview.mockResolvedValue({ ...data, trailerKey: null });
    await hover(renderTile(4));
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("iframe")).toBeNull();
    expect(dialog.querySelector("img")?.getAttribute("src")).toContain("/b.jpg");
  });

  it("shows a neutral placeholder without trailer and backdrop", async () => {
    mockedGetPreview.mockResolvedValue({ ...data, trailerKey: null, backdropPath: null });
    await hover(renderTile(5));
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("iframe")).toBeNull();
    expect(dialog.querySelector("img")).toBeNull();
  });

  it("lets pointer events pass through the trailer so leaving it closes the preview", async () => {
    await hover(renderTile(10));
    const iframe = screen.getByRole("dialog").querySelector("iframe")!;
    expect(iframe.classList.contains("pointer-events-none")).toBe(true);
  });

  it("toggles the trailer sound via postMessage", async () => {
    await hover(renderTile(6));
    const iframe = screen.getByRole("dialog").querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=abc123&enablejsapi=1",
    );
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    fireEvent.click(screen.getByRole("button", { name: "Ton an" }));
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: "command", func: "unMute", args: [] }),
      "https://www.youtube-nocookie.com",
    );
    expect(screen.getByRole("button", { name: "Ton aus" })).toBeTruthy();
  });

  it("never opens on devices without hover", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    await hover(renderTile(7));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockedGetPreview).not.toHaveBeenCalled();
  });

  it("stays open while the mouse moves into the preview and closes when it leaves", async () => {
    const tile = renderTile(8);
    await hover(tile);
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseLeave(tile, { relatedTarget: dialog });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.mouseLeave(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on page scroll but not when an inner element scrolls", async () => {
    await hover(renderTile(9));
    fireEvent.scroll(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.scroll(window);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("retries the lookup after a failed one", async () => {
    mockedGetPreview.mockResolvedValueOnce(null);
    const tile = renderTile(11);
    await hover(tile);
    fireEvent.keyDown(document, { key: "Escape" });
    await hover(tile);
    expect(mockedGetPreview).toHaveBeenCalledTimes(2);
  });

  it("re-places the preview when its height changes and stops observing on close", async () => {
    let resize = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const tile = renderTile(12);
    tile.parentElement!.getBoundingClientRect = () =>
      ({ left: 0, top: 400, width: 100, height: 100 }) as DOMRect;
    await hover(tile);
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.top).toBe("390px");
    Object.defineProperty(dialog, "offsetHeight", { value: 500 });
    act(() => resize());
    expect(dialog.style.top).toBe(`${window.innerHeight - 8 - 500}px`);
    const disconnects = disconnect.mock.calls.length;
    fireEvent.keyDown(document, { key: "Escape" });
    expect(disconnect).toHaveBeenCalledTimes(disconnects + 1);
  });
});
