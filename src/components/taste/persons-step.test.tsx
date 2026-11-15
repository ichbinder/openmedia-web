import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PersonsStep } from "./persons-step";

describe("PersonsStep", () => {
  it("saves trimmed names and keeps known ids", async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    render(<PersonsStep persons={[{ id: "p1", name: "Anna", limits: [], limitsText: "" }]} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Name 1"), { target: { value: "  Anna K.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Person hinzufügen" }));
    fireEvent.change(screen.getByLabelText("Name 2"), { target: { value: " Ben " } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ id: "p1", name: "Anna K." }, { name: "Ben" }]),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Gespeichert.");
  });

  it("needs at least one person", async () => {
    const onSave = vi.fn();
    render(<PersonsStep persons={[]} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Name 1"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Mindestens eine Person");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("allows at most six persons", () => {
    const persons = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, limits: [], limitsText: "" }));
    render(<PersonsStep persons={persons} onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Person hinzufügen" })).toBeDisabled();
  });
});
