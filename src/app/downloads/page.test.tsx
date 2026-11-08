import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import DownloadsPage from "./page";

const mockRefresh = vi.hoisted(() => vi.fn(async () => []));
vi.mock("@/contexts/download-context", () => ({
  useDownloads: () => ({ jobs: [], isLoading: false, refresh: mockRefresh }),
  getStatusLabel: (s: string) => s,
  isJobStale: () => false,
}));
vi.mock("@/components/auth/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => children,
}));

it("reloads the job list when the downloads page opens", () => {
  render(<DownloadsPage />);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});
