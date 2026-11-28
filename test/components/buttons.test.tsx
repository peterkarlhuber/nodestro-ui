// Icon buttons as a product meets them: the label shown as the shared tooltip (not a native title), and the two-step
// ConfirmIconButton for an action that cannot be undone (arm, confirm, Escape, leaving it, the timeout, and the focus
// around it).
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIRM_MS, ConfirmIconButton, IconButton, UiTextProvider } from "@nodestro/ui-core";

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

const Trash = <svg data-testid="trash" />;

describe("IconButton tooltip", () => {
  it("shows its label as the shared tooltip on keyboard focus, with no native title", async () => {
    render(<IconButton label="Settings" icon={<svg />} />);
    const button = screen.getByRole("button", { name: "Settings" });
    expect(button.hasAttribute("title")).toBe(false);
    await user.tab();
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole("tooltip").textContent).toBe("Settings");
  });

  it("shows it on hover after a short delay", async () => {
    render(<IconButton label="Settings" icon={<svg />} />);
    await user.hover(screen.getByRole("button", { name: "Settings" }));
    await wait(400);
    expect(screen.getByRole("tooltip").textContent).toBe("Settings");
  });
});

describe("ConfirmIconButton", () => {
  it("the first press arms it and moves the focus, the second acts and gives the focus back", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmIconButton label="Delete run" icon={Trash} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Delete run" }));
    expect(onConfirm).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Delete run: Delete?" });
    expect(document.activeElement).toBe(confirm);
    expect(confirm.textContent).toContain("Delete?");
    expect(confirm.className).toContain("ui-button--danger");
    expect(confirm.querySelector("[data-testid=trash]")?.closest("[aria-hidden='true']")).toBeTruthy();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete run" }));
  });

  it("Escape turns it back without acting, keeps the focus and does not reach a dialog around it", async () => {
    const onConfirm = vi.fn();
    const onOuterKey = vi.fn();
    render(
      <div onKeyDown={(event) => event.key === "Escape" && onOuterKey()}>
        <ConfirmIconButton label="Delete run" icon={Trash} onConfirm={onConfirm} />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Delete run" }));
    await user.keyboard("{Escape}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOuterKey).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete run" }));
  });

  it("leaving it or waiting CONFIRM_MS turns it back", async () => {
    render(
      <>
        <ConfirmIconButton label="Delete run" icon={Trash} onConfirm={() => undefined} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Delete run" }));
    fireEvent.blur(screen.getByRole("button", { name: "Delete run: Delete?" }));
    expect(screen.queryByRole("button", { name: "Delete run: Delete?" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Delete run" }));
    await wait(CONFIRM_MS - 100);
    expect(screen.getByRole("button", { name: "Delete run: Delete?" })).toBeTruthy();
    await wait(200);
    expect(screen.queryByRole("button", { name: "Delete run: Delete?" })).toBeNull();
  });

  it("speaks the reader's language and takes its own confirmation text", async () => {
    render(
      <UiTextProvider locale="de">
        <ConfirmIconButton label="Lauf löschen" icon={Trash} onConfirm={() => undefined} />
        <ConfirmIconButton label="Schlüssel entfernen" icon={Trash} confirmLabel="Entfernen?" onConfirm={() => undefined} />
      </UiTextProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Lauf löschen" }));
    expect(screen.getByRole("button", { name: "Lauf löschen: Löschen?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Schlüssel entfernen" }));
    expect(screen.getByRole("button", { name: "Schlüssel entfernen: Entfernen?" })).toBeTruthy();
  });

  it("while busy the icon button cannot be armed", async () => {
    render(<ConfirmIconButton label="Delete run" icon={Trash} busy onConfirm={() => undefined} />);
    const button = screen.getByRole("button", { name: /Delete run/ });
    await user.click(button);
    expect(screen.queryByRole("button", { name: /Delete\?/ })).toBeNull();
  });
});
