import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TitleMeta } from "@/lib/backend";
import { OriginLabel } from "./origin-label";
import { TileRatings } from "./tile-ratings";
import { AllRatings } from "./all-ratings";

const base: TitleMeta = { kind: "movie", tmdbId: 1, label: null, brand: null, ratings: {}, score: null };

describe("TileRatings", () => {
  it("shows both values with aria-label", () => {
    render(<TileRatings meta={{ ...base, ratings: { critics: 36, audience: 92 } }} />);
    const el = screen.getByLabelText("Kritiker 36 Prozent, Zuschauer 92 Prozent");
    expect(el.textContent).toBe("🍅 36% · 🍿 92%");
  });

  it("drops a missing value", () => {
    render(<TileRatings meta={{ ...base, ratings: { audience: 92 } }} />);
    expect(screen.getByLabelText("Zuschauer 92 Prozent").textContent).toBe("🍿 92%");
  });

  it("renders nothing without values", () => {
    const { container } = render(<TileRatings meta={base} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("OriginLabel", () => {
  it("shows the label", () => {
    render(<OriginLabel meta={{ ...base, label: "NETFLIX", brand: "netflix" }} />);
    expect(screen.getByText("NETFLIX")).toBeInTheDocument();
  });

  it("renders nothing for label null", () => {
    const { container } = render(<OriginLabel meta={base} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AllRatings", () => {
  it("lists present ratings only", () => {
    render(<AllRatings meta={{ ...base, ratings: { imdb: 6.3, critics: 36 }, score: 56 }} />);
    expect(screen.getByText("IMDb 6.3")).toBeInTheDocument();
    expect(screen.getByText("MDBList 56")).toBeInTheDocument();
    expect(screen.getByText("🍅 Kritiker 36%")).toBeInTheDocument();
    expect(screen.queryByText(/Metacritic/)).toBeNull();
  });
});
