import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LikesStep } from "./likes-step";
import { LimitsStep } from "./limits-step";

describe("LikesStep", () => {
  it("saves toggled genres and text", async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    render(<LikesStep genres={["drama"]} likesText="" onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Krimi" }));
    fireEvent.click(screen.getByRole("button", { name: "Drama" }));
    fireEvent.change(screen.getByLabelText("Was schaut ihr gern?"), { target: { value: "Nordic Noir" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(["krimi"], "Nordic Noir"));
  });
});

describe("LimitsStep", () => {
  it("saves limits per person", async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    const persons = [
      { id: "a", name: "Anna", limits: [], limitsText: "" },
      { id: "b", name: "Ben", limits: ["horror"], limitsText: "" },
    ];
    render(<LimitsStep persons={persons} onSave={onSave} />);
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Horror" })[0]);
    fireEvent.change(screen.getByLabelText("Weitere Grenzen für Ben"), { target: { value: "Spinnen" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { id: "a", limits: ["horror"], limitsText: "" },
        { id: "b", limits: ["horror"], limitsText: "Spinnen" },
      ]),
    );
  });
});
