// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const push = vi.fn();
const setActiveRoleAction = vi.fn(async (_role: string) => {});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/actions", () => ({ setActiveRoleAction: (r: string) => setActiveRoleAction(r) }));

import { RoleSwitcher } from "@/components/role-switcher";

describe("RoleSwitcher (WCAG 3.2.2 On Input)", () => {
  afterEach(cleanup);
  beforeEach(() => {
    push.mockClear();
    setActiveRoleAction.mockClear();
  });

  it("changing the menu does not switch role or navigate", () => {
    render(<RoleSwitcher id="rs" activeRole="member" availableRoles={["member", "mentor"]} />);
    fireEvent.change(screen.getByLabelText("Active role"), { target: { value: "mentor" } });
    expect(setActiveRoleAction).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows Switch only after a different role is picked, and switches on press", async () => {
    const onSwitched = vi.fn();
    render(
      <RoleSwitcher id="rs" activeRole="member" availableRoles={["member", "mentor"]} onSwitched={onSwitched} />
    );
    expect(screen.queryByRole("button", { name: "Switch" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Active role"), { target: { value: "mentor" } });
    fireEvent.click(screen.getByRole("button", { name: "Switch" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(setActiveRoleAction).toHaveBeenCalledWith("mentor");
    expect(onSwitched).toHaveBeenCalled();
  });
});
