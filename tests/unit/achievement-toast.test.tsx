// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { AchievementToast } from "@/components/celebration";

describe("AchievementToast", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("stays until closed (WCAG 2.2.1)", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<AchievementToast trophies={[{ key: "a", title: "First log" }]} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("First log");
    fireEvent.click(screen.getByRole("button", { name: "Close achievement message" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
