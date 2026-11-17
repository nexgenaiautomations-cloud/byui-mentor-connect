// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";

function Harness({ escapable = true }: { escapable?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useDialogFocus(open, escapable ? () => setOpen(false) : undefined);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      <button>Behind</button>
      {open && (
        <div ref={ref} role="dialog" aria-label="Test dialog">
          <button>First</button>
          <input aria-label="Middle" />
          <button onClick={() => setOpen(false)}>Last</button>
        </div>
      )}
    </div>
  );
}

const tab = (shift = false) => fireEvent.keyDown(document, { key: "Tab", shiftKey: shift });

describe("useDialogFocus", () => {
  afterEach(cleanup);

  it("moves focus into the dialog on open", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("wraps Tab from the last element to the first, and Shift+Tab back", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    screen.getByRole("button", { name: "Last" }).focus();
    tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    tab(true);
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the opener", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("returns focus to the opener when closed by a button", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Last" }));
    expect(opener).toHaveFocus();
  });

  it("ignores Escape when no onClose is given", () => {
    render(<Harness escapable={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("prefers an [autofocus] element", () => {
    function AutoHarness() {
      const ref = useDialogFocus(true, vi.fn());
      return (
        <div ref={ref} role="dialog" aria-label="x">
          <button>One</button>
          <textarea aria-label="Note" data-autofocus />
        </div>
      );
    }
    render(<AutoHarness />);
    expect(screen.getByLabelText("Note")).toHaveFocus();
  });

  it("only the topmost of two open dialogs handles Escape", () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    function Two() {
      const a = useDialogFocus(true, closeA);
      const b = useDialogFocus(true, closeB);
      return (
        <>
          <div ref={a} role="dialog" aria-label="A"><button>a</button></div>
          <div ref={b} role="dialog" aria-label="B"><button>b</button></div>
        </>
      );
    }
    render(<Two />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });
});
