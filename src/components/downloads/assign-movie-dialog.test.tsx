import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AssignMovieDialog } from "./assign-movie-dialog";

// ── Mocks ──────────────────────────────────────────────────────────

// Server Action — replaced with a mock fn we control per test
vi.mock("@/app/actions/tmdb-search", () => ({
  searchTmdbForAssign: vi.fn(),
}));

// Backend client
vi.mock("@/lib/backend", () => ({
  assignMovieToJob: vi.fn(),
}));

// Auth helper
vi.mock("@/lib/auth", () => ({
  getToken: vi.fn(() => "test-token"),
}));

// Sonner toast — track calls but don't render
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// next/image — render a plain img so jsdom doesn't choke on the runtime
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

import { searchTmdbForAssign } from "@/app/actions/tmdb-search";
import { assignMovieToJob } from "@/lib/backend";
import { toast } from "sonner";

const mockSearchTmdbForAssign = vi.mocked(searchTmdbForAssign);
const mockAssignMovieToJob = vi.mocked(assignMovieToJob);
const mockToastSuccess = vi.mocked(toast.success);
const mockToastError = vi.mocked(toast.error);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────

describe("AssignMovieDialog", () => {
  it("rendert Header und Hint-Block wenn open=true", () => {
    render(
      <AssignMovieDialog
        open={true}
        onOpenChange={() => {}}
        jobId="job-123"
        hint={{
          filename: "Cryptic.Release.Name.2099.nzb",
          parsedTitle: "Cryptic Release Name",
          parsedYear: 2099,
        }}
        onAssigned={() => {}}
      />,
    );

    expect(screen.getByText("Film zuordnen")).toBeInTheDocument();
    expect(screen.getByText(/NZB ohne TMDB-Treffer/i)).toBeInTheDocument();
    expect(screen.getByText("Cryptic.Release.Name.2099.nzb")).toBeInTheDocument();
    expect(screen.getByText(/Cryptic Release Name/)).toBeInTheDocument();
  });

  it("zeigt Hinweis wenn weniger als 2 Zeichen getippt wurden", () => {
    render(
      <AssignMovieDialog
        open={true}
        onOpenChange={() => {}}
        jobId="job-123"
        onAssigned={() => {}}
      />,
    );

    expect(
      screen.getByText("Tippe mindestens 2 Zeichen, um zu suchen"),
    ).toBeInTheDocument();
    expect(mockSearchTmdbForAssign).not.toHaveBeenCalled();
  });

  it("triggert die Server Action nach 300ms Debounce und zeigt Treffer", async () => {
    mockSearchTmdbForAssign.mockResolvedValueOnce([
      {
        id: 603,
        title: "Matrix",
        originalTitle: "The Matrix",
        year: 1999,
        posterPath: "/matrix.jpg",
        overview: "Ein Hacker entdeckt die Wahrheit",
      },
      {
        id: 604,
        title: "Matrix Reloaded",
        originalTitle: "The Matrix Reloaded",
        year: 2003,
        posterPath: "/reloaded.jpg",
        overview: "Fortsetzung",
      },
    ]);

    render(
      <AssignMovieDialog
        open={true}
        onOpenChange={() => {}}
        jobId="job-123"
        onAssigned={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText("Filmtitel suchen…");
    fireEvent.change(input, { target: { value: "matrix" } });

    // Wait for debounce + mock resolution
    await waitFor(
      () => {
        expect(mockSearchTmdbForAssign).toHaveBeenCalledWith("matrix");
      },
      { timeout: 1000 },
    );

    await waitFor(() => {
      expect(screen.getByText("Matrix")).toBeInTheDocument();
      expect(screen.getByText("Matrix Reloaded")).toBeInTheDocument();
    });
  });

  it("ruft assignMovieToJob mit der gewählten tmdbId und schließt den Dialog bei Erfolg", async () => {
    mockSearchTmdbForAssign.mockResolvedValueOnce([
      {
        id: 603,
        title: "Matrix",
        originalTitle: "The Matrix",
        year: 1999,
        posterPath: "/matrix.jpg",
        overview: "Ein Hacker",
      },
    ]);
    mockAssignMovieToJob.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        movie: {
          id: "movie-uuid",
          tmdbId: 603,
          imdbId: "tt0133093",
          titleDe: "Matrix",
          titleEn: "The Matrix",
          year: 1999,
          posterPath: "/matrix.jpg",
        },
        flippedCount: 1,
        alreadyAssigned: false,
      },
    });

    const onOpenChange = vi.fn();
    const onAssigned = vi.fn();

    render(
      <AssignMovieDialog
        open={true}
        onOpenChange={onOpenChange}
        jobId="job-abc"
        onAssigned={onAssigned}
      />,
    );

    const input = screen.getByPlaceholderText("Filmtitel suchen…");
    fireEvent.change(input, { target: { value: "matrix" } });

    // Wait for the result button to render
    const matrixButton = await screen.findByRole(
      "button",
      { name: /matrix/i },
      { timeout: 1000 },
    );
    fireEvent.click(matrixButton);

    await waitFor(() => {
      expect(mockAssignMovieToJob).toHaveBeenCalledWith("job-abc", 603, "test-token");
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Zugeordnet"),
        expect.objectContaining({ description: expect.stringContaining("Download") }),
      );
      expect(onAssigned).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("zeigt Error-Toast wenn der Backend-Call fehlschlägt", async () => {
    mockSearchTmdbForAssign.mockResolvedValueOnce([
      {
        id: 603,
        title: "Matrix",
        originalTitle: "The Matrix",
        year: 1999,
        posterPath: null,
        overview: "",
      },
    ]);
    mockAssignMovieToJob.mockResolvedValueOnce({
      ok: false,
      status: 503,
      // backendFetch always types data as the generic T, but on errors the
      // backend actually returns { error: "..." }. Cast to satisfy the
      // AssignMovieResponse generic at the call site while still exercising
      // the dialog's error-extraction code path.
      data: { error: "TMDB-Lookup fehlgeschlagen." } as unknown as Awaited<
        ReturnType<typeof mockAssignMovieToJob>
      >["data"],
    });

    const onOpenChange = vi.fn();
    render(
      <AssignMovieDialog
        open={true}
        onOpenChange={onOpenChange}
        jobId="job-abc"
        onAssigned={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText("Filmtitel suchen…");
    fireEvent.change(input, { target: { value: "matrix" } });

    const matrixButton = await screen.findByRole(
      "button",
      { name: /matrix/i },
      { timeout: 1000 },
    );
    fireEvent.click(matrixButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("TMDB-Lookup fehlgeschlagen.");
    });

    // Dialog should NOT close on error
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
