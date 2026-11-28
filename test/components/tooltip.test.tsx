// Tooltip as a product meets it on its buttons, badges and values: hover after a short delay and keyboard focus at
// once, a tooltip that can be hovered and dismissed (WCAG 1.4.13), Escape that hides it and still reaches the dialog
// around it, one tooltip or help panel at a time, inside a modal dialog part of the dialog (the top layer is in
// tooltip-layer.test.tsx), the text and link of a registered help entry, and placement inside the window.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HelpProvider, HelpTip, Tooltip } from "@nodestro/ui-core";
import { placeLayerAt } from "../../packages/core/src/layer.js";

const HELP = {
  entries: {
    "flow.approval": { title: "Approvals", summary: "A step that waits for a person.", href: "/docs/approvals" },
    "flow.budget": { title: "Budget", summary: "The most a run may cost." },
  },
};

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

function tipOf(element: HTMLElement): HTMLElement | null {
  const ids = (element.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
  for (const id of ids) {
    const tip = document.getElementById(id)?.closest<HTMLElement>("[role=tooltip]");
    if (tip) return tip;
  }
  return null;
}

describe("Tooltip on hover and focus", () => {
  it("shows on hover after a short delay; hidden, it is not in the page", async () => {
    render(
      <Tooltip content="Runs the workflow once">
        <button type="button">Run</button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Run" });
    expect(screen.queryByText("Runs the workflow once")).toBeNull();
    await user.hover(button);
    // Not at once: passing the pointer over the page does not flash tooltips.
    expect(screen.queryByRole("tooltip")).toBeNull();
    await wait(400);
    expect(screen.getByRole("tooltip").textContent).toBe("Runs the workflow once");
    // Described by its text, not by the whole tooltip.
    expect(document.getElementById(button.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Runs the workflow once");
  });

  it("the tooltip can be hovered; leaving both hides it", async () => {
    render(
      <Tooltip content="Runs the workflow once">
        <button type="button">Run</button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Run" });
    await user.hover(button);
    await wait(400);
    const tip = screen.getByRole("tooltip");
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    fireEvent.pointerEnter(tip, { pointerType: "mouse" });
    await wait(300);
    expect(tip.isConnected).toBe(true);
    fireEvent.pointerLeave(tip, { pointerType: "mouse" });
    await wait(300);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows on keyboard focus at once and hides when focus moves on", async () => {
    render(
      <>
        <Tooltip content="Runs the workflow once">
          <button type="button">Run</button>
        </Tooltip>
        <button type="button">Next</button>
      </>,
    );
    await user.tab();
    expect(tipOf(screen.getByRole("button", { name: "Run" }))?.textContent).toBe("Runs the workflow once");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" }));
    await wait(300);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("a hide queued by a pointer leave never hides what focus has just shown", async () => {
    render(
      <Tooltip content="Runs the workflow once">
        <button type="button">Run</button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Run" });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    await user.tab();
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    await wait(400);
    expect(screen.getByRole("tooltip").textContent).toBe("Runs the workflow once");
  });

  it("a press on its element hides it and still acts; touch has no hover", async () => {
    const onClick = vi.fn();
    render(
      <Tooltip content="Runs the workflow once">
        <button type="button" onClick={onClick}>
          Run
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Run" });
    await user.hover(button);
    await wait(400);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerEnter(button, { pointerType: "touch" });
    await wait(400);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps the element's own handlers and description", async () => {
    const onFocus = vi.fn();
    const onPointerEnter = vi.fn();
    render(
      <>
        <span id="extra">Extra</span>
        <Tooltip content="Runs the workflow once">
          <button type="button" aria-describedby="extra" onFocus={onFocus} onPointerEnter={onPointerEnter}>
            Run
          </button>
        </Tooltip>
      </>,
    );
    const button = screen.getByRole("button", { name: "Run" });
    expect(button.getAttribute("aria-describedby")).toBe("extra");
    await user.tab();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-describedby")?.split(" ")[0]).toBe("extra");
    expect(tipOf(button)?.textContent).toBe("Runs the workflow once");
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(onPointerEnter).toHaveBeenCalledTimes(1);
  });

  it("without a text it is only its element", () => {
    render(
      <Tooltip content={null}>
        <button type="button">Run</button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Run" });
    fireEvent.focus(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(button.getAttribute("aria-describedby")).toBeNull();
  });

  it("only one tooltip or help panel is open at a time", async () => {
    render(
      <HelpProvider {...HELP}>
        <Tooltip content="Runs the workflow once">
          <button type="button">Run</button>
        </Tooltip>
        <Tooltip content="Stops the run">
          <button type="button">Stop</button>
        </Tooltip>
        <HelpTip id="flow.budget" />
      </HelpProvider>,
    );
    await user.tab();
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    await user.tab();
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip").textContent).toBe("Stops the run");
    await user.click(screen.getByRole("button", { name: "Help: Budget" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("group", { name: "Budget" })).toBeTruthy();
    await user.tab({ shift: true });
    expect(screen.queryByRole("group", { name: "Budget" })).toBeNull();
    expect(screen.getByRole("tooltip").textContent).toBe("Stops the run");
  });

  it("a press outside or a scroll of the page hides it", async () => {
    render(
      <>
        <Tooltip content="Runs the workflow once">
          <button type="button">Run</button>
        </Tooltip>
        <p>Elsewhere</p>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("Tooltip with a help entry", () => {
  it("shows the entry's summary and a link that opens its article in the product", async () => {
    const onOpen = vi.fn();
    render(
      <HelpProvider {...HELP} onOpen={onOpen}>
        <Tooltip help="flow.approval">
          <button type="button">Approve</button>
        </Tooltip>
      </HelpProvider>,
    );
    const button = screen.getByRole("button", { name: "Approve" });
    await user.hover(button);
    await wait(400);
    const tip = screen.getByRole("tooltip");
    expect(document.getElementById(button.getAttribute("aria-describedby") ?? "")?.textContent).toBe("A step that waits for a person.");
    const link = screen.getByRole("link", { name: "Learn more" });
    expect(link.getAttribute("href")).toBe("/docs/approvals");
    // The tooltip of a focused element is gone once focus moves on: its link is for the pointer, not a Tab stop.
    expect(link.tabIndex).toBe(-1);
    fireEvent.pointerEnter(tip, { pointerType: "mouse" });
    await user.click(link);
    expect(onOpen).toHaveBeenCalledWith("flow.approval", HELP.entries["flow.approval"]);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("content replaces the summary and keeps the link; an unknown entry adds nothing", async () => {
    render(
      <HelpProvider {...HELP}>
        <Tooltip help="flow.approval" content="Waits for you.">
          <button type="button">Approve</button>
        </Tooltip>
        <Tooltip help="flow.missing">
          <button type="button">Other</button>
        </Tooltip>
      </HelpProvider>,
    );
    await user.tab();
    expect(screen.getByRole("tooltip").textContent).toContain("Waits for you.");
    expect(screen.getByRole("link", { name: "Learn more" }).getAttribute("href")).toBe("/docs/approvals");
    await user.tab();
    await wait(300);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("button", { name: "Other" }).getAttribute("aria-describedby")).toBeNull();
  });
});

describe("Tooltip in a dialog", () => {
  it("is part of the dialog, not of the page beneath it", async () => {
    render(
      <dialog open>
        <Tooltip content="Closes without saving">
          <button type="button">Cancel</button>
        </Tooltip>
      </dialog>,
    );
    await user.tab();
    expect(screen.getByRole("tooltip").closest("dialog")).not.toBeNull();
  });

  it("Escape hides it and still reaches the dialog; focus stays where it was", async () => {
    const onDialogKey = vi.fn();
    render(
      <dialog open onKeyDown={(event) => onDialogKey(event.key)}>
        <Tooltip content="Closes without saving">
          <button type="button">Cancel</button>
        </Tooltip>
      </dialog>,
    );
    const button = screen.getByRole("button", { name: "Cancel" });
    await user.tab();
    expect(screen.getByRole("tooltip")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(onDialogKey).toHaveBeenCalledWith("Escape");
    expect(document.activeElement).toBe(button);
  });

  it("a press on the tooltip text acts on neither the label nor the control it labels", async () => {
    render(
      <label>
        <Tooltip content="What the switch does">
          <span tabIndex={0}>Notify me</span>
        </Tooltip>
        <input type="checkbox" />
      </label>,
    );
    await user.tab();
    await user.click(screen.getByRole("tooltip"));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    // The label itself still works.
    await user.click(screen.getByText("Notify me"));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });
});

describe("Tooltip placement", () => {
  const view = { width: 400, height: 300 };
  const size = { width: 100, height: 40 };
  it("on the preferred side, flipped when there is no room, always inside the window", () => {
    const middle = { top: 140, bottom: 160, left: 150, width: 100 };
    expect(placeLayerAt(middle, size, view, "top")).toEqual({ top: 92, left: 150, below: false });
    expect(placeLayerAt(middle, size, view, "bottom")).toEqual({ top: 168, left: 150, below: true });
    const atTop = { top: 10, bottom: 30, left: 0, width: 20 };
    expect(placeLayerAt(atTop, size, view, "top")).toMatchObject({ top: 38, left: 8, below: true });
    const atBottom = { top: 270, bottom: 290, left: 380, width: 20 };
    expect(placeLayerAt(atBottom, size, view, "bottom")).toMatchObject({ top: 222, left: 292, below: false });
    // Taller than the window: kept inside it (the tooltip scrolls, styles.css).
    expect(placeLayerAt(middle, { width: 100, height: 500 }, view, "top").top).toBe(8);
  });

  // The cases of nodestro-studio's own tooltip (its Tooltip.test.tsx before ST-068 step 6), on the shared placement.
  it("the studio's cases: above and centred, flipped at the top edge, shifted from the side edges", () => {
    const studioView = { width: 1000, height: 800 };
    const studioSize = { width: 300, height: 100 };
    expect(placeLayerAt({ top: 400, bottom: 420, left: 490, width: 20 }, studioSize, studioView, "top")).toEqual({ top: 292, left: 350, below: false });
    const flipped = placeLayerAt({ top: 20, bottom: 40, left: 990, width: 10 }, studioSize, studioView, "top");
    expect(flipped.below).toBe(true);
    expect(flipped.top).toBe(48);
    expect(flipped.left).toBe(1000 - 300 - 8);
    expect(placeLayerAt({ top: 400, bottom: 420, left: 0, width: 10 }, studioSize, studioView, "top").left).toBe(8);
    expect(placeLayerAt({ top: 300, bottom: 320, left: 400, width: 20 }, { width: 300, height: 900 }, studioView, "top").top).toBeGreaterThanOrEqual(8);
  });
});
