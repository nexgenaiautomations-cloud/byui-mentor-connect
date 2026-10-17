// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";

const confetti = vi.fn();
vi.mock("canvas-confetti", () => ({ default: confetti }));
vi.mock("next/link", () => ({
  default: ({ href, onClick, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

import { useState } from "react";
import { OfferCelebration } from "@/components/celebration";
import type { CelebrationKind } from "@/lib/possible-actions";

// Mirrors the log form: the parent clears `kind` when the celebration closes.
function Host({ kind }: { kind: CelebrationKind }) {
  const [k, setK] = useState<CelebrationKind | null>(kind);
  return <OfferCelebration kind={k} onDone={() => setK(null)} />;
}

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduce && q.includes("reduce"),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// Let the dynamic import of canvas-confetti resolve.
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  confetti.mockClear();
  mockReducedMotion(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("OfferCelebration", () => {
  it("renders nothing when no offer was logged", () => {
    const { container } = render(<OfferCelebration kind={null} onDone={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe.each(["internship", "part_time"] as const)("%s (dialog)", (kind) => {
    it("'Keep going' closes it", () => {
      const onDone = vi.fn();
      render(<OfferCelebration kind={kind} onDone={onDone} />);
      fireEvent.click(screen.getByRole("button", { name: "Keep going" }));
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("'Keep going' gets focus so keyboard users can dismiss it", () => {
      render(<OfferCelebration kind={kind} onDone={() => {}} />);
      expect(screen.getByRole("button", { name: "Keep going" })).toHaveFocus();
    });

    it("'See my trophies' links to the trophy case and closes", () => {
      const onDone = vi.fn();
      render(<OfferCelebration kind={kind} onDone={onDone} />);
      const link = screen.getByRole("link", { name: "See my trophies" });
      expect(link).toHaveAttribute("href", "/trophy-case");
      fireEvent.click(link);
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("Esc closes it", () => {
      const onDone = vi.fn();
      render(<OfferCelebration kind={kind} onDone={onDone} />);
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("is announced as a dialog with a title", () => {
      render(<OfferCelebration kind={kind} onDone={() => {}} />);
      expect(screen.getByRole("dialog")).toHaveAccessibleName();
    });
  });

  it("internship: clicking the dimmed backdrop closes it, clicking the card does not", () => {
    const onDone = vi.fn();
    const { container } = render(<OfferCelebration kind="internship" onDone={onDone} />);
    fireEvent.click(screen.getByText("Internship offer!"));
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector(".backdrop-blur-sm")!);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("part-time: clicking the dark background closes it, clicking the text does not", () => {
    const onDone = vi.fn();
    render(<OfferCelebration kind="part_time" onDone={onDone} />);
    fireEvent.click(screen.getByText(/part-time offer/i));
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  describe("full_time (seal + banner)", () => {
    it("the ✕ button closes it", () => {
      const onDone = vi.fn();
      render(<OfferCelebration kind="full_time" onDone={onDone} />);
      fireEvent.click(screen.getByRole("button", { name: "Close celebration" }));
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("does not block the page (status, not a modal dialog)", () => {
      render(<OfferCelebration kind="full_time" onDone={() => {}} />);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent(/You're hired/);
    });

    it("Esc closes it", () => {
      const onDone = vi.fn();
      render(<OfferCelebration kind="full_time" onDone={onDone} />);
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onDone).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ["internship", 7000],
    ["part_time", 7500],
    ["full_time", 6000],
  ] as const)("%s closes on its own after %ims", (kind, ms) => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<OfferCelebration kind={kind} onDone={onDone} />);
    act(() => vi.advanceTimersByTime(ms - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("does not close twice when a button is clicked before the auto-close", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<OfferCelebration kind="internship" onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep going" }));
    act(() => vi.advanceTimersByTime(10_000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("fires confetti", async () => {
    render(<OfferCelebration kind="internship" onDone={() => {}} />);
    await flush();
    expect(confetti).toHaveBeenCalled();
  });

  it("skips confetti for people who prefer reduced motion", async () => {
    mockReducedMotion(true);
    render(<OfferCelebration kind="internship" onDone={() => {}} />);
    await flush();
    expect(confetti).not.toHaveBeenCalled();
    // The buttons still work without the animation.
    expect(screen.getByRole("button", { name: "Keep going" })).toBeInTheDocument();
  });

  it("re-rendering the parent does not restart the celebration", async () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const { rerender } = render(<OfferCelebration kind="internship" onDone={first} />);
    await flush();
    const callsAfterStart = confetti.mock.calls.length;
    act(() => vi.advanceTimersByTime(4000));
    const second = vi.fn();
    rerender(<OfferCelebration kind="internship" onDone={second} />);
    await flush();
    act(() => vi.advanceTimersByTime(3000));
    // Original 7s timer still fires (4s + 3s), using the latest onDone.
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(confetti.mock.calls.length).toBeLessThanOrEqual(callsAfterStart + 4);
  });

  it.each(["internship", "part_time", "full_time"] as const)(
    "%s: closing right away stops all confetti",
    async (kind) => {
      vi.useFakeTimers();
      render(<Host kind={kind} />);
      const closeButton =
        kind === "full_time"
          ? screen.getByRole("button", { name: "Close celebration" })
          : screen.getByRole("button", { name: "Keep going" });
      fireEvent.click(closeButton);
      expect(screen.queryByRole(kind === "full_time" ? "status" : "dialog")).toBeNull();
      await flush();
      act(() => vi.advanceTimersByTime(10_000));
      expect(confetti).not.toHaveBeenCalled();
    }
  );
});
