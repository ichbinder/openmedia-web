import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
import { Header } from "./header";

describe("Header", () => {
  it("links Vorschläge to /vorschlaege", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Vorschläge" })).toHaveAttribute("href", "/vorschlaege");
  });
});
