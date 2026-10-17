// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { AgreementForm } from "@/app/agreements/agreement-form";
import { SchoolInquiryForm } from "@/app/schools/inquiry-form";
import { AGREEMENT_ITEMS } from "@/lib/agreements";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AgreementForm (profile setup checkboxes)", () => {
  const continueButton = () => screen.getByRole("button", { name: "Continue" });
  const boxes = () => screen.getAllByRole("checkbox");

  it("shows one checkbox per acknowledgment", () => {
    render(<AgreementForm />);
    expect(boxes()).toHaveLength(AGREEMENT_ITEMS.length);
  });

  it("keeps Continue disabled until every box is checked", () => {
    render(<AgreementForm />);
    expect(continueButton()).toBeDisabled();
    boxes().slice(0, -1).forEach((b) => fireEvent.click(b));
    expect(continueButton()).toBeDisabled();
    fireEvent.click(boxes().at(-1)!);
    expect(continueButton()).toBeEnabled();
  });

  it("clicking the label text toggles its checkbox", () => {
    render(<AgreementForm />);
    fireEvent.click(screen.getByText(/GDW Innovations, LLC/));
    expect(boxes()[0]).toBeChecked();
    fireEvent.click(screen.getByText(/GDW Innovations, LLC/));
    expect(boxes()[0]).not.toBeChecked();
  });

  it("the Terms and Privacy links open the right pages in a new tab", () => {
    render(<AgreementForm />);
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("target", "_blank");
  });

  it("Continue saves every acknowledgment and moves on", async () => {
    const fetchMock = mockFetch(200, { ok: true, redirectTo: "/onboarding" });
    render(<AgreementForm />);
    boxes().forEach((b) => fireEvent.click(b));
    fireEvent.click(continueButton());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/agreements");
    expect(JSON.parse(init.body)).toEqual({
      independent: true,
      optional: true,
      outcomes: true,
      safety: true,
      terms: true,
    });
  });

  it("shows the server's error instead of moving on", async () => {
    mockFetch(400, { error: "Please check every box to continue." });
    render(<AgreementForm />);
    boxes().forEach((b) => fireEvent.click(b));
    fireEvent.click(continueButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Please check every box");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("SchoolInquiryForm (For schools page)", () => {
  function fill() {
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Pat Example" } });
    fireEvent.change(screen.getByLabelText(/Work email/), { target: { value: "pat@state.edu" } });
    fireEvent.change(screen.getByLabelText(/^School/), { target: { value: "State University" } });
  }
  const send = () => screen.getByRole("button", { name: "Send to the ICAN team" });

  it("sends the form and shows a thank-you", async () => {
    const fetchMock = mockFetch(200, { ok: true });
    render(<SchoolInquiryForm />);
    fill();
    fireEvent.click(send());
    expect(await screen.findByRole("status")).toHaveTextContent("Thanks, we got it.");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/school-inquiries");
    expect(JSON.parse(init.body)).toMatchObject({
      contactName: "Pat Example",
      contactEmail: "pat@state.edu",
      schoolName: "State University",
      website: "",
    });
  });

  it("shows the server's error and keeps the form", async () => {
    mockFetch(429, { error: "Too many requests from this network." });
    render(<SchoolInquiryForm />);
    fill();
    fireEvent.click(send());
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
    expect(send()).toBeEnabled();
  });

  it("marks name, email and school as required", () => {
    render(<SchoolInquiryForm />);
    expect(screen.getByLabelText(/Your name/)).toBeRequired();
    expect(screen.getByLabelText(/Work email/)).toBeRequired();
    expect(screen.getByLabelText(/^School/)).toBeRequired();
    expect(screen.getByLabelText(/Your role/)).not.toBeRequired();
  });

  it("keeps the spam trap out of the tab order", () => {
    render(<SchoolInquiryForm />);
    expect(screen.getByLabelText("Website")).toHaveAttribute("tabindex", "-1");
  });
});
