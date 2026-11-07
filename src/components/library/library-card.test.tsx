import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LibraryCard, libraryItemLink } from "./library-card";
import type { LibraryItem } from "@/lib/backend";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("@/lib/auth", () => ({ getToken: vi.fn(() => "t") }));

afterEach(cleanup);

const baseFile = {
  id: "f1",
  hash: "h",
  resolution: "1080p",
  qualityTier: null,
  s3Key: "k",
  s3StreamKey: "sk",
  fileExtension: ".mkv",
  downloadedAt: null,
  status: "ok" as const,
  brokenReason: null,
  failedAttempts: 0,
  lastAccessedAt: null,
  scheduledDeletionAt: null,
};

const movieItem: LibraryItem = {
  id: "l1",
  addedAt: "2026-01-01",
  removedAt: null,
  nzbFile: {
    ...baseFile,
    movie: { id: "m1", tmdbId: 603, titleDe: "Matrix", titleEn: "The Matrix", year: 1999, posterPath: "/m.jpg" },
    episode: null,
  },
};

const episodeItem: LibraryItem = {
  id: "l2",
  addedAt: "2026-01-01",
  removedAt: null,
  nzbFile: {
    ...baseFile,
    movie: null,
    episode: {
      id: "e1",
      season: 2,
      episode: 5,
      titleDe: "Trojan's Horse",
      show: { tmdbId: 95396, titleDe: "Severance", titleEn: "Severance", year: 2022, posterPath: "/s.jpg" },
    },
  },
};

describe("LibraryCard", () => {
  it("shows an episode with show title, SxxExx line, poster and series link", () => {
    render(<LibraryCard item={episodeItem} onRemove={() => {}} />);
    expect(screen.getByText("Severance")).toBeTruthy();
    expect(screen.getByText("S02E05 · Trojan's Horse")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("src")).toContain("/s.jpg");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/serie/95396");
    expect(hrefs).toContain("/serie/95396#play");
    expect(libraryItemLink(episodeItem)).toBe("/serie/95396");
  });

  it("shows a film as before", () => {
    render(<LibraryCard item={movieItem} onRemove={() => {}} />);
    expect(screen.getByText("Matrix")).toBeTruthy();
    expect(screen.getByText("1999")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("src")).toContain("/m.jpg");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/movie/603");
    expect(hrefs).toContain("/movie/603#play");
    expect(libraryItemLink(movieItem)).toBe("/movie/603");
  });
});
