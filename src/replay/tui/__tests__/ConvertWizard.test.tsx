import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { ConvertWizard, type ConvertFormValues } from "../ConvertWizard";

function flush() {
  return new Promise((r) => setTimeout(r, 10));
}

const DOWN = "[B"; // down-arrow escape sequence
const BACKSPACE = "";
const ESC = "";
const STATS = { calls: 5, sessions: 1, dropped: 7, corrupt: 0 };

function renderWizard(over: Partial<Parameters<typeof ConvertWizard>[0]> = {}) {
  const onAccept = vi.fn<(v: ConvertFormValues) => void>();
  const onSkip = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <ConvertWizard
      fileLabel="x_ocpp_logs.json"
      index={0}
      total={2}
      initialStationId="x"
      stats={STATS}
      width={70}
      onAccept={onAccept}
      onSkip={onSkip}
      onCancel={onCancel}
      {...over}
    />,
  );
  return { ...utils, onAccept, onSkip, onCancel };
}

describe("ConvertWizard", () => {
  it("renders prefilled stationId, progress, parse summary, default rebase", async () => {
    const { lastFrame } = renderWizard();
    await flush();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("x_ocpp_logs.json");
    expect(frame).toContain("file 1/2");
    expect(frame).toContain("[x]");
    expect(frame).toContain("5 calls");
    expect(frame).toContain("1 session");
    expect(frame).toContain("7 dropped");
    expect(frame).toContain("(•) rebase to now");
  });

  it("edits the focused text field; arrows move focus; space toggles", async () => {
    const { lastFrame, stdin, onAccept } = renderWizard();
    await flush();
    stdin.write("1"); // appends to stationId
    await flush();
    expect(lastFrame()).toContain("[x1]");
    stdin.write(DOWN); // → password
    stdin.write("pw");
    await flush();
    expect(lastFrame()).toContain("[pw]");
    stdin.write(DOWN); // → timestamps
    stdin.write(" "); // toggle to keep-original
    await flush();
    expect(lastFrame()).toContain("(•) keep original");
    stdin.write("\r"); // accept
    await flush();
    expect(onAccept).toHaveBeenCalledWith({
      stationId: "x1",
      password: "pw",
      rebaseTimestamps: false,
    });
  });

  it("backspace deletes from the focused field", async () => {
    const { lastFrame, stdin } = renderWizard();
    await flush();
    stdin.write(BACKSPACE);
    await flush();
    expect(lastFrame()).not.toContain("[x]");
  });

  it("ignores enter when stationId is empty", async () => {
    const { stdin, onAccept } = renderWizard({ initialStationId: "" });
    await flush();
    stdin.write("\r");
    await flush();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("esc cancels", async () => {
    const { stdin, onCancel } = renderWizard();
    await flush();
    stdin.write(ESC);
    await flush();
    expect(onCancel).toHaveBeenCalled();
  });

  it("error mode shows the error and enter skips instead of accepting", async () => {
    const { lastFrame, stdin, onAccept, onSkip } = renderWizard({
      error: "no replayable sessions found",
    });
    await flush();
    expect(lastFrame()).toContain("no replayable sessions found");
    expect(lastFrame()).toContain("continue");
    stdin.write("\r");
    await flush();
    expect(onSkip).toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });
});
