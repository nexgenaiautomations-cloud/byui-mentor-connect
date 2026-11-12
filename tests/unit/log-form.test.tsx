// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/components/celebration", () => ({
  AchievementToast: () => null,
  OfferCelebration: () => null,
  fireConfetti: vi.fn(),
}));

import { LogActivityForm } from "@/app/(app)/log-meeting/form";
import { DictationButton } from "@/components/dictation-button";

function mockFetch() {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ log: {}, newlyEarned: [], autoLogged: [] }),
  });
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
  // jsdom has no SpeechRecognition by default; tests that add one remove it.
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

async function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Log (activity|meeting)/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Confirm & Submit/ }));
}

describe("LogActivityForm — event kind", () => {
  it("a member without a mentor only logs independent activity", async () => {
    const fetchMock = mockFetch();
    render(<LogActivityForm mode="mentee" hasMentor={false} />);
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByLabelText("Worked on my resume"));
    await submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.eventKind).toBe("independent_activity");
    expect(body.nextMeetingDate).toBeNull();
  });

  it("a member with a mentor can say they met their mentor and schedule the next meeting", async () => {
    const fetchMock = mockFetch();
    render(<LogActivityForm mode="mentee" hasMentor />);
    expect(screen.getByRole("radio", { name: /On my own/ })).toBeChecked();
    expect(screen.queryByLabelText("Date")).toBeNull(); // no scheduling for solo work
    fireEvent.click(screen.getByRole("radio", { name: /Met my mentor/ }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2030-02-10" } });
    fireEvent.change(screen.getByLabelText(/Time/), { target: { value: "15:30" } });
    fireEvent.click(screen.getByLabelText("Worked on my resume"));
    await submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.eventKind).toBe("mentor_meeting");
    expect(body.nextMeetingDate).toBe("2030-02-10");
    expect(body.nextMeetingTime).toBe("15:30");
    expect(typeof body.nextMeetingTimezone).toBe("string");
  });

  it("mentors log a meeting by default and may log a touchpoint", async () => {
    const fetchMock = mockFetch();
    render(
      <LogActivityForm
        mode="mentor"
        matches={[{ id: "11111111-1111-1111-1111-111111111111", menteeName: "Ana", menteeImage: null, menteeMajor: null }]}
      />
    );
    expect(screen.getByRole("radio", { name: /Meeting/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Touchpoint/ }));
    fireEvent.click(screen.getByLabelText("Helped with resumes"));
    await submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).eventKind).toBe("touchpoint");
  });
});

describe("Dictation", () => {
  it("falls back to typing when the browser has no speech recognition", () => {
    render(<DictationButton value="" onChange={() => {}} />);
    expect(screen.getByText(/isn.t available in this browser/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dictate/ })).toBeNull();
  });

  it("only listens after an explicit press and appends final text", () => {
    const instances: { start: ReturnType<typeof vi.fn>; onresult: ((e: unknown) => void) | null }[] = [];
    class FakeRec {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror = null;
      onend = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        instances.push(this);
      }
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRec;
    const onChange = vi.fn();
    render(<DictationButton value="Met today." onChange={onChange} />);
    expect(instances).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /Dictate/ }));
    expect(instances).toHaveLength(1);
    expect(instances[0].start).toHaveBeenCalled();
    const result = Object.assign([{ transcript: "we reviewed the resume" }], { isFinal: true });
    instances[0].onresult!({ resultIndex: 0, results: [result] });
    expect(onChange).toHaveBeenCalledWith("Met today. We reviewed the resume");
  });

  it("suggests checkboxes from typed notes but checks nothing on its own", () => {
    render(<LogActivityForm mode="mentee" hasMentor={false} />);
    fireEvent.change(screen.getByPlaceholderText(/Add anything else/), {
      target: { value: "I updated my LinkedIn" },
    });
    const box = screen.getByLabelText("Updated LinkedIn or another professional platform");
    expect(box).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /\+ Updated LinkedIn/ }));
    expect(box).toBeChecked();
  });
});
