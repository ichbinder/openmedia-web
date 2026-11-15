import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResumePrompt } from "./resume-prompt";

describe("ResumePrompt", () => {
  it("zeigt die Stelle und ruft die Rückrufe", () => {
    const onResume = vi.fn();
    const onRestart = vi.fn();
    render(<ResumePrompt positionSec={2832} onResume={onResume} onRestart={onRestart} />);
    expect(screen.getByText("Weiterschauen ab 47:12?")).toBeTruthy();
    fireEvent.click(screen.getByText("Fortsetzen"));
    expect(onResume).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Von vorne"));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
