// HelpTip in a browser with the Popover API (jsdom has none, so it is stubbed before the package loads): the panel
// is a manual popover, shown in the top layer while open (above modal dialogs) and taken out of it when closed.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const open = new WeakSet<Element>();
const show = vi.fn(function (this: HTMLElement) {
  open.add(this);
});
const hide = vi.fn(function (this: HTMLElement) {
  open.delete(this);
});
const matches = HTMLElement.prototype.matches;

beforeAll(() => {
  Object.assign(HTMLElement.prototype, { showPopover: show, hidePopover: hide });
  HTMLElement.prototype.matches = function (this: HTMLElement, selector: string) {
    return selector === ":popover-open" ? open.has(this) : matches.call(this, selector);
  };
});

afterAll(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
  delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
  HTMLElement.prototype.matches = matches;
});

afterEach(cleanup);

describe("HelpTip in the top layer", () => {
  it("is a manual popover, raised while open and lowered when closed", async () => {
    vi.resetModules();
    const { HelpProvider, HelpTip } = await import("@nodestro/ui-core");
    render(
      <HelpProvider entries={{ a: { title: "A", summary: "About A." } }}>
        <dialog open>
          <HelpTip id="a" />
        </dialog>
      </HelpProvider>,
    );
    const button = screen.getByRole("button", { name: "Help: A" });
    await userEvent.click(button);
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "")!;
    expect(panel.getAttribute("popover")).toBe("manual");
    expect(show).toHaveBeenCalledTimes(1);
    expect(open.has(panel)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(hide).toHaveBeenCalledTimes(1);
    expect(open.has(panel)).toBe(false);
    expect(panel.isConnected).toBe(false);
  });
});
