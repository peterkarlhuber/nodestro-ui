// Tooltip in a browser with the Popover API (jsdom has none, so it is stubbed before the package loads): the tooltip
// is a manual popover, shown in the top layer while shown (above modal dialogs) and taken out of it when hidden.
import { cleanup, render } from "@testing-library/react";
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

describe("Tooltip in the top layer", () => {
  it("is a manual popover inside the dialog, raised while shown and lowered when hidden", async () => {
    vi.resetModules();
    const { Tooltip } = await import("@nodestro/ui-core");
    render(
      <dialog open>
        <Tooltip content="Closes without saving">
          <button type="button">Cancel</button>
        </Tooltip>
      </dialog>,
    );
    await userEvent.tab();
    // (jsdom's own stylesheet hides a popover it does not know as open, so not getByRole)
    const tip = document.querySelector<HTMLElement>("[role=tooltip]")!;
    expect(tip.textContent).toBe("Closes without saving");
    expect(tip.getAttribute("popover")).toBe("manual");
    expect(tip.closest("dialog")).not.toBeNull();
    expect(show).toHaveBeenCalledTimes(1);
    expect(open.has(tip)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(hide).toHaveBeenCalledTimes(1);
    expect(open.has(tip)).toBe(false);
    expect(tip.isConnected).toBe(false);
  });
});
