// HelpTip as a product meets it everywhere (not only next to an error): hover and keyboard focus open it, the panel
// can be hovered and dismissed (WCAG 1.4.13), Escape closes only the panel inside a dialog, the panel stays part of the
// button's dialog (the top layer is in helptip-layer.test.tsx), Tab leads into its link and out again, and the button
// names its entry with data-help. In the browser the panel is in the DOM only while it is open.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HelpProvider, HelpTip } from "@nodestro/ui-core";

const HELP = {
  entries: {
    "flow.approval": { title: "Approvals", summary: "A step that waits for a person.", href: "/docs/approvals" },
    "flow.budget": { title: "Budget", summary: "The most a run may cost." },
  },
};

function panelOf(button: HTMLElement): HTMLElement | null {
  const id = button.getAttribute("aria-controls");
  return id ? document.getElementById(id) : null;
}

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HelpTip on hover and focus", () => {
  it("names its entry with data-help and opens on hover after a short delay", async () => {
    render(
      <HelpProvider {...HELP}>
        <HelpTip id="flow.approval" topic="the approval step" />
      </HelpProvider>,
    );
    const button = screen.getByRole("button", { name: "Help: the approval step" });
    expect(button.getAttribute("data-help")).toBe("flow.approval");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    // Closed, its texts are not in the page (they would double the label next to it for text search).
    expect(screen.queryByText("A step that waits for a person.")).toBeNull();
    expect(button.getAttribute("aria-controls")).toBeNull();
    await user.hover(button);
    // Not at once: passing the pointer over the page does not flash help.
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("group", { name: "Approvals" });
    expect(panel.hidden).toBe(false);
    // The button is described by the summary (screen readers read it with the button, open or not).
    expect(document.getElementById(button.getAttribute("aria-describedby") ?? "")?.textContent).toBe("A step that waits for a person.");
  });

  it("the panel can be hovered; leaving both closes it", async () => {
    render(
      <HelpProvider {...HELP}>
        <HelpTip id="flow.approval" />
      </HelpProvider>,
    );
    const button = screen.getByRole("button", { name: "Help: Approvals" });
    await user.hover(button);
    await act(() => vi.advanceTimersByTimeAsync(400));
    const panel = panelOf(button)!;
    // From the button onto the panel: it stays.
    await user.unhover(button);
    await user.hover(panel);
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(panel.hidden).toBe(false);
    await user.unhover(panel);
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(panel.isConnected).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens on keyboard focus at once and closes when focus moves on", async () => {
    render(
      <HelpProvider {...HELP}>
        <HelpTip id="flow.budget" />
        <button type="button">Next</button>
      </HelpProvider>,
    );
    await user.tab();
    const button = screen.getByRole("button", { name: "Help: Budget" });
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await user.tab();
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("a close queued by a pointer leave never hides what focus has just opened", async () => {
    render(
      <HelpProvider {...HELP}>
        <button type="button">Before</button>
        <HelpTip id="flow.budget" />
      </HelpProvider>,
    );
    const button = screen.getByRole("button", { name: "Help: Budget" });
    await user.hover(button);
    await act(() => vi.advanceTimersByTimeAsync(400));
    await user.unhover(button);
    // Within the close delay, Tab reaches the button.
    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(button);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("a press pins it open, a second press closes it; touch has no hover", async () => {
    render(
      <HelpProvider {...HELP}>
        <HelpTip id="flow.budget" />
      </HelpProvider>,
    );
    const button = screen.getByRole("button", { name: "Help: Budget" });
    fireEvent.pointerOver(button, { pointerType: "touch" });
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await user.unhover(button);
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("only one panel is open at a time", async () => {
    render(
      <HelpProvider {...HELP}>
        <HelpTip id="flow.approval" />
        <HelpTip id="flow.budget" />
      </HelpProvider>,
    );
    const first = screen.getByRole("button", { name: "Help: Approvals" });
    const second = screen.getByRole("button", { name: "Help: Budget" });
    await user.click(first);
    await user.click(second);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("true");
  });

  it("a press outside closes a pinned panel", async () => {
    render(
      <HelpProvider {...HELP}>
        <HelpTip id="flow.approval" />
        <p>Elsewhere</p>
      </HelpProvider>,
    );
    const button = screen.getByRole("button", { name: "Help: Approvals" });
    await user.click(button);
    await user.click(screen.getByText("Elsewhere"));
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("HelpTip inside a label or a summary", () => {
  it("a press on the button or its panel acts on neither the section nor the labelled control", async () => {
    const onToggle = vi.fn();
    render(
      <HelpProvider {...HELP}>
        <details onToggle={onToggle}>
          <summary>
            Section <HelpTip id="flow.budget" />
          </summary>
        </details>
        <label>
          Name <HelpTip id="flow.approval" /> <input />
        </label>
      </HelpProvider>,
    );
    const inSummary = screen.getByRole("button", { name: "Help: Budget" });
    await user.click(inSummary);
    await user.click(screen.getByText("The most a run may cost."));
    expect((document.querySelector("details") as HTMLDetailsElement).open).toBe(false);
    const inLabel = screen.getByRole("button", { name: "Help: Approvals" });
    await user.click(inLabel);
    await user.click(screen.getByText("A step that waits for a person."));
    expect(document.activeElement).not.toBe(screen.getByRole("textbox"));
    expect(inLabel.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("HelpTip in a dialog", () => {
  function InDialog({ onKey }: { onKey: () => void }) {
    return (
      <HelpProvider {...HELP}>
        <dialog open onKeyDown={onKey} aria-label="Settings">
          <input aria-label="Name" />
          <HelpTip id="flow.approval" />
          <button type="button">Save</button>
        </dialog>
      </HelpProvider>
    );
  }

  it("keeps its panel inside the dialog, not in the page beneath it", async () => {
    render(<InDialog onKey={() => undefined} />);
    const button = screen.getByRole("button", { name: "Help: Approvals" });
    await user.click(button);
    const panel = panelOf(button)!;
    expect(panel.closest("dialog")).toBe(screen.getByRole("dialog"));
    expect(panel.parentElement).toBe(button.parentElement);
    // Positioned through the CSSOM, never a style attribute from the markup (strict CSP).
    expect(panel.style.top).toMatch(/px$/);
  });

  it("Escape closes only the panel, never the dialog, and focus stays where it was", async () => {
    const onKey = vi.fn();
    render(<InDialog onKey={onKey} />);
    const input = screen.getByRole("textbox", { name: "Name" });
    const button = screen.getByRole("button", { name: "Help: Approvals" });
    await user.hover(button);
    await act(() => vi.advanceTimersByTimeAsync(400));
    input.focus();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await user.keyboard("{Escape}");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(onKey).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    // Without an open panel Escape reaches the dialog again.
    await user.keyboard("{Escape}");
    expect(onKey).toHaveBeenCalledTimes(1);
  });

  it("pinned: Tab leads into the link, the next Tab on to the control after the button (no focus trap)", async () => {
    render(<InDialog onKey={() => undefined} />);
    const button = screen.getByRole("button", { name: "Help: Approvals" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await user.tab();
    const link = within(panelOf(button)!).getByRole("link", { name: "Learn more" });
    expect(document.activeElement).toBe(link);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save" }));
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(button.getAttribute("aria-expanded")).toBe("false");
    // Shift+Tab from the link goes back to the button.
    button.focus();
    await user.keyboard("{Enter}");
    await user.tab();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(button);
  });

  it("shown only by passing focus, the panel keeps the normal Tab order", async () => {
    render(<InDialog onKey={() => undefined} />);
    screen.getByRole("textbox", { name: "Name" }).focus();
    await user.tab();
    const button = screen.getByRole("button", { name: "Help: Approvals" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save" }));
  });
});

describe("placement", () => {
  it("above the anchor, below when there is no room above, always inside the window", async () => {
    const { placeLayer } = await import("../../packages/core/src/layer.js");
    const view = { width: 800, height: 600 };
    const size = { width: 200, height: 100 };
    expect(placeLayer({ top: 300, bottom: 320, left: 400, width: 20 }, size, view)).toEqual({ top: 192, left: 310, below: false });
    expect(placeLayer({ top: 40, bottom: 60, left: 400, width: 20 }, size, view)).toEqual({ top: 68, left: 310, below: true });
    expect(placeLayer({ top: 300, bottom: 320, left: 0, width: 20 }, size, view).left).toBe(8);
    expect(placeLayer({ top: 300, bottom: 320, left: 790, width: 20 }, size, view).left).toBe(592);
    // Taller than the window: pinned to the top margin (the panel scrolls itself).
    expect(placeLayer({ top: 300, bottom: 320, left: 400, width: 20 }, { width: 200, height: 900 }, view).top).toBe(8);
  });
});
