// @nodestro/ui-core behaviour: names, states, keyboard and focus as a person with a keyboard or a screen reader meets
// them.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Badge,
  Button,
  Collapsible,
  ConfirmDialog,
  Dialog,
  ErrorHelp,
  Field,
  HelpProvider,
  HelpTip,
  IconButton,
  ListDetail,
  Select,
  TextArea,
  TextInput,
  Tooltip,
  UiTextProvider,
  HelpSearch,
  createHelpIndex,
  errorKeyFor,
  foldSearchText,
  helpCoverage,
  helpEntriesFromCatalog,
  helpIdForError,
  nodeText,
  isInAppPath,
  safeHelpHref,
} from "@nodestro/ui-core";

afterEach(cleanup);

describe("Button", () => {
  it("is a button that does not submit by default", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button");
  });

  it("while busy says so and ignores clicks, but stays focusable", async () => {
    const onClick = vi.fn();
    render(
      <Button busy onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("an icon button has its label as accessible name, also while busy", () => {
    const { rerender } = render(<IconButton label="Delete" icon={<svg />} />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    rerender(
      <UiTextProvider locale="de">
        <IconButton label="Löschen" icon={<svg />} busy />
      </UiTextProvider>,
    );
    expect(screen.getByRole("button", { name: "Löschen (Wird ausgeführt …)" })).toBeTruthy();
  });

  it("a badge shows its text, the tone only adds a class", () => {
    render(<Badge tone="danger">Failed</Badge>);
    expect(screen.getByText("Failed").className).toContain("ui-badge--danger");
  });
});

describe("Field", () => {
  it("links label, hint and error to the control", () => {
    render(
      <Field label="Name" hint="As shown to others" error="Too short" required>
        <TextInput value="x" onChange={() => {}} />
      </Field>,
    );
    const input = screen.getByLabelText(/Name/);
    const described = (input.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(["As shown to others", "Too short"]);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.hasAttribute("required")).toBe(true);
    expect(screen.getByText("Name").textContent).toBe("Name (required)");
  });

  it("works for a text area and a native select", async () => {
    const onChange = vi.fn();
    render(
      <>
        <Field label="Note">
          <TextArea defaultValue="" />
        </Field>
        <Field label="Colour">
          <Select
            value="red"
            onChange={onChange}
            options={[
              { value: "red", label: "Red" },
              { value: "blue", label: "Blue" },
            ]}
          />
        </Field>
      </>,
    );
    expect(screen.getByLabelText("Note").tagName).toBe("TEXTAREA");
    await userEvent.selectOptions(screen.getByLabelText("Colour"), "blue");
    expect(onChange).toHaveBeenCalledWith("blue");
  });

  it("keeps a control's own id and description", () => {
    render(
      <Field label="Own" htmlFor="own" hint="Hint">
        <TextInput id="own" aria-describedby="extra" />
      </Field>,
    );
    const input = screen.getByLabelText("Own");
    expect(input.id).toBe("own");
    expect(input.getAttribute("aria-describedby")).toMatch(/-hint extra$/);
  });
});

function DialogHarness({ initial = false }: { initial?: boolean }) {
  const [open, setOpen] = useState(false);
  const second = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rename"
        description="Give it a new name."
        initialFocus={initial ? second : undefined}
        footer={
          <>
            <button type="button">First</button>
            <button type="button" ref={second}>
              Second
            </button>
          </>
        }
      >
        <input aria-label="New name" />
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("is a named, described modal dialog that takes focus and returns it on close", async () => {
    render(<DialogHarness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Rename" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Give it a new name.");
    // The first focusable element: the close button.
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("traps Tab and Shift+Tab inside", async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Close" });
    const last = within(dialog).getByRole("button", { name: "Second" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    // In between, Tab moves normally (the trap does not interfere).
    await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("focuses the initial focus element and closes with the close button", async () => {
    render(<DialogHarness initial />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Second" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a confirmation is an alert dialog that starts on Cancel", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete?" message="This cannot be undone." tone="danger" onConfirm={onConfirm} onCancel={onCancel} />);
    const dialog = screen.getByRole("alertdialog", { name: "Delete?" });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("Collapsible", () => {
  it("is a disclosure: aria-expanded, aria-controls and a hidden region", async () => {
    const onOpenChange = vi.fn();
    render(
      <Collapsible title="Advanced" summary="3 settings" onOpenChange={onOpenChange}>
        <p>Inside</p>
      </Collapsible>,
    );
    const toggle = screen.getByRole("button", { name: /Advanced/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const region = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(region?.hidden).toBe(true);
    expect(screen.queryByText("Inside")).toBeNull();
    toggle.focus();
    await userEvent.keyboard("{Enter}");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: /Advanced/ }).textContent).toBe("Inside");
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard(" ");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("can be controlled and uses the given heading level", () => {
    render(
      <Collapsible title="Log" open level={2}>
        <p>Lines</p>
      </Collapsible>,
    );
    expect(screen.getByRole("heading", { level: 2, name: /Log/ })).toBeTruthy();
    expect(screen.getByText("Lines")).toBeTruthy();
  });
});

const ITEMS = [
  { id: "a", label: "Alpha", description: "first" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

function ListHarness() {
  const [selected, setSelected] = useState<string | null>(null);
  return <ListDetail label="Entries" items={ITEMS} selectedId={selected} onSelect={setSelected} renderDetail={(item) => <p>Detail of {item.id}</p>} />;
}

describe("ListDetail", () => {
  it("is a listbox with one tab stop; arrows, Home and End move the selection and the details follow", async () => {
    render(<ListHarness />);
    const list = screen.getByRole("listbox", { name: "Entries" });
    const options = within(list).getAllByRole("option");
    expect(options.map((o) => o.tabIndex)).toEqual([0, -1, -1]);
    expect(screen.getByText("Select an entry to see its details.")).toBeTruthy();
    await userEvent.tab();
    expect(document.activeElement).toBe(options[0]);
    await userEvent.keyboard("{ArrowDown}");
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{ArrowDown}");
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(options[1]);
    expect(screen.getByText("Detail of b")).toBeTruthy();
    await userEvent.keyboard("{End}");
    expect(options[2].getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{Home}");
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options.map((o) => o.tabIndex)).toEqual([0, -1, -1]);
    const detail = screen.getByText("Detail of a").closest("section");
    expect(detail?.getAttribute("aria-labelledby")).toBe(options[0].id);
  });

  it("selects with a click and shows an empty state", async () => {
    const { rerender } = render(<ListHarness />);
    await userEvent.click(screen.getByRole("option", { name: "Gamma" }));
    expect(screen.getByText("Detail of c")).toBeTruthy();
    rerender(<ListDetail label="Entries" items={[]} selectedId={null} onSelect={() => {}} renderDetail={() => null} />);
    expect(screen.getByText("Nothing to show.")).toBeTruthy();
  });
});

describe("Tooltip", () => {
  it("describes its element, shows on focus and hides on Escape", async () => {
    render(
      <Tooltip content="Runs the workflow once">
        <button type="button">Run</button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Run" });
    const tip = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    expect(tip?.getAttribute("role")).toBe("tooltip");
    expect(tip?.textContent).toBe("Runs the workflow once");
    expect(tip?.hidden).toBe(true);
    await userEvent.tab();
    expect(tip?.hidden).toBe(false);
    await userEvent.keyboard("{Escape}");
    expect(tip?.hidden).toBe(true);
    await userEvent.hover(button);
    expect(tip?.hidden).toBe(false);
    await userEvent.unhover(button);
    expect(tip?.hidden).toBe(true);
  });
});

const HELP = {
  entries: {
    "flow.approval": { title: "Approvals", summary: "A step that waits for a person.", href: "/docs/approvals" },
    unsafe: { title: "Unsafe", summary: "Bad link", href: "javascript:alert(1)" },
  },
  errors: { "approval.comment_required": "flow.approval", "run.gone": "missing.entry" },
};

describe("HelpTip and context help", () => {
  it("opens the registered entry, closes on Escape and returns focus", async () => {
    render(
      <HelpProvider {...HELP}>
        <HelpTip id="flow.approval" />
      </HelpProvider>,
    );
    const button = screen.getByRole("button", { name: "Help: Approvals" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("group", { name: "Approvals" });
    expect(panel.textContent).toContain("A step that waits for a person.");
    expect(within(panel).getByRole("link", { name: "Learn more" }).getAttribute("href")).toBe("/docs/approvals");
    within(panel).getByRole("link").focus();
    await userEvent.keyboard("{Escape}");
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it("lets the product open the article itself (context help)", async () => {
    const onOpen = vi.fn();
    render(
      <HelpProvider {...HELP} onOpen={onOpen}>
        <HelpTip id="flow.approval" topic="the approval step" />
      </HelpProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Help: the approval step" }));
    await userEvent.click(screen.getByRole("link", { name: "Learn more" }));
    expect(onOpen).toHaveBeenCalledWith("flow.approval", HELP.entries["flow.approval"]);
  });

  it("drops links that are not http(s) or in-app, and renders nothing for an unknown id", () => {
    render(
      <HelpProvider {...HELP}>
        <HelpTip id="unsafe" />
        <HelpTip id="nope" />
      </HelpProvider>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("link", { hidden: true })).toBeNull();
    expect(safeHelpHref("https://example.org/a")).toBe("https://example.org/a");
    expect(safeHelpHref("//evil.example")).toBeUndefined();
    expect(safeHelpHref("data:text/html,x")).toBeUndefined();
    expect(safeHelpHref("#anchor")).toBe("#anchor");
  });

  it("links an error code to its help", async () => {
    render(
      <HelpProvider {...HELP}>
        <ErrorHelp code="approval.comment_required">A comment is required to reject.</ErrorHelp>
        <ErrorHelp code="something.else">Something else failed.</ErrorHelp>
      </HelpProvider>,
    );
    const [first, second] = screen.getAllByRole("alert");
    expect(first.textContent).toContain("Error code approval.comment_required");
    expect(within(first).getByRole("button", { name: "Help: Approvals" })).toBeTruthy();
    expect(within(second).queryByRole("button")).toBeNull();
    expect(helpIdForError(HELP, "run.gone")).toBeNull();
  });

  it("reports coverage: missing codes, dangling references and stale exceptions", () => {
    const codes = ["approval.comment_required", "run.gone", "run.timeout", "budget.exceeded"];
    expect(helpCoverage(codes, HELP, { "budget.exceeded": "Shown with its own dialog", "old.code": "gone", "approval.comment_required": "x" })).toEqual({
      missing: ["run.timeout"],
      dangling: ["run.gone"],
      staleExceptions: ["approval.comment_required", "old.code"],
      unusedMappings: [],
    });
    expect(helpCoverage(["approval.comment_required"], HELP)).toEqual({ missing: [], dangling: [], staleExceptions: [], unusedMappings: ["run.gone"] });
  });
});

describe("text lookup", () => {
  it("uses the product's answer first, then the package language, then English", () => {
    const translate = (key: string) => (key === "core.dialog.close" ? "Zumachen" : undefined);
    render(
      <UiTextProvider locale="de-AT" translate={translate}>
        <Dialog open onClose={() => {}} title="T" />
        <ConfirmDialog open title="C" message="M" onConfirm={() => {}} onCancel={() => {}} />
      </UiTextProvider>,
    );
    expect(screen.getAllByRole("button", { name: "Zumachen" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeTruthy();
  });

  it("re-renders in the new language", () => {
    const { rerender } = render(
      <UiTextProvider locale="fr">
        <ListDetail label="L" items={[]} selectedId={null} onSelect={() => {}} renderDetail={() => null} />
      </UiTextProvider>,
    );
    expect(screen.getByText("Rien à afficher.")).toBeTruthy();
    act(() =>
      rerender(
        <UiTextProvider locale="pt">
          <ListDetail label="L" items={[]} selectedId={null} onSelect={() => {}} renderDetail={() => null} />
        </UiTextProvider>,
      ),
    );
    expect(screen.getByText("Nada para mostrar.")).toBeTruthy();
  });
});

describe("links that could leave the site (open redirect)", () => {
  const OUTSIDE = ["//evil.example", "/\\evil.example", "/\\\\evil.example", "\\\\evil.example", "/\t/evil.example", "/\n/evil.example", "/x\u0000y", "/x\u007fy", "https://evil.example/\\x", "#a\nb"];
  it("are refused by safeHelpHref and isInAppPath", () => {
    for (const href of OUTSIDE) expect(safeHelpHref(href), JSON.stringify(href)).toBeUndefined();
    for (const href of OUTSIDE) expect(isInAppPath(href), JSON.stringify(href)).toBe(false);
    expect(safeHelpHref("/docs/a?b=c#d")).toBe("/docs/a?b=c#d");
    expect(isInAppPath("/docs/a")).toBe(true);
  });

  it("never become a link in a HelpTip", async () => {
    render(<HelpTip entry={{ title: "T", summary: "S", href: "/\\evil.example" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Help: T" }));
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("error families", () => {
  const registry = {
    entries: { "help.runs": { title: "Runs", summary: "S" }, "help.tools": { title: "Tools", summary: "S" } },
    errors: { "run.*": "help.runs", "run.agent.*": "help.tools", "run.special": "help.tools", "http.*": "help.runs" },
  };

  it("resolve the exact code first, then the longest family", () => {
    expect(helpIdForError(registry, "run.special")).toBe("help.tools");
    expect(helpIdForError(registry, "run.agent.AuthenticationError")).toBe("help.tools");
    expect(helpIdForError(registry, "run.timeout")).toBe("help.runs");
    expect(helpIdForError(registry, "http.<status>")).toBe("help.runs");
    expect(helpIdForError(registry, "run")).toBeNull();
    expect(helpIdForError(registry, "run.")).toBeNull();
    expect(helpIdForError(registry, "runner.x")).toBeNull();
    expect(errorKeyFor(registry.errors, "run.*")).toBe("run.*");
  });

  it("count for coverage, exceptions may be families too", () => {
    const codes = ["run.timeout", "run.agent.X", "notice.a", "notice.b", "other.x"];
    expect(helpCoverage(codes, registry, { "notice.*": "Shown as information, not as an error", "run.timeout": "contradicts the family", "gone.*": "x" })).toEqual({
      missing: ["other.x"],
      dangling: [],
      staleExceptions: ["gone.*", "run.timeout"],
      unusedMappings: ["http.*", "run.special"],
    });
    expect(helpCoverage(["notice.a"], { entries: {} }, { "notice.*": " " }).staleExceptions).toEqual(["notice.*"]);
  });
});

describe("help from a six-language catalog", () => {
  const catalog = {
    en: { "x.a.title": "Approvals", "x.a.summary": "Waits for a person.", "x.a.keywords": "consent", "x.b.title": "Budget", "x.b.summary": "Money." },
    de: { "x.a.title": "Freigaben", "x.a.summary": "Wartet auf eine Person.", "x.a.keywords": "Zustimmung", "x.b.title": "Budget", "x.b.summary": "Geld." },
    fr: {},
    es: {},
    it: {},
    "pt-BR": {},
  };

  it("uses the language, falls back to English, and adds links", () => {
    expect(helpEntriesFromCatalog(catalog, "de", { hrefs: { "x.a": "/docs/a" } })).toEqual({
      "x.a": { title: "Freigaben", summary: "Wartet auf eine Person.", keywords: "Zustimmung", href: "/docs/a" },
      "x.b": { title: "Budget", summary: "Geld." },
    });
    expect(helpEntriesFromCatalog(catalog, "fr")["x.a"]).toEqual({ title: "Approvals", summary: "Waits for a person.", keywords: "consent" });
    const own = helpEntriesFromCatalog(catalog, "it", { translate: (key) => (key === "x.b.title" ? "Bilancio" : undefined) });
    expect(own["x.b"].title).toBe("Bilancio");
  });
});

describe("offline help search", () => {
  const entries = {
    "flow.approval": { title: "Approvals", summary: <>A step that <em>waits</em> for a person.</>, href: "/docs/approvals", keywords: "consent" },
    "flow.budget": { title: "Budget", summary: "Limits what a run may spend; approvals do not change it." },
    "de.translation": { title: "Übersetzung", summary: "Straße und Größe." },
  };
  const index = createHelpIndex(entries);

  it("finds by word starts, ranks the title first, needs every word, ignores case and accents", () => {
    expect(index.search("appro").map((hit) => hit.id)).toEqual(["flow.approval", "flow.budget"]);
    expect(index.search("APPROVALS budget").map((hit) => hit.id)).toEqual(["flow.budget"]);
    expect(index.search("consent").map((hit) => hit.id)).toEqual(["flow.approval"]);
    expect(index.search("waits").map((hit) => hit.id)).toEqual(["flow.approval"]);
    expect(index.search("ubersetzung strasse").map((hit) => hit.id)).toEqual(["de.translation"]);
    expect(index.search("grosse").map((hit) => hit.id)).toEqual(["de.translation"]);
    expect(index.search("flow.budget").map((hit) => hit.id)).toEqual(["flow.budget"]);
    expect(index.search("  ")).toEqual([]);
    expect(index.search("nothing-like-this")).toEqual([]);
    expect(index.search("a", { limit: 1 })).toHaveLength(1);
    const withErrors = createHelpIndex(entries, { "budget.*": "flow.budget", "approval.expired": "flow.approval" });
    expect(withErrors.search(" budget.over_limit ").map((hit) => hit.id)).toEqual(["flow.budget"]);
    expect(withErrors.search("approval.expired").map((hit) => hit.id)).toEqual(["flow.approval"]);
    expect(withErrors.search("budget approvals").map((hit) => hit.id)).toEqual(["flow.budget"]);
    expect(foldSearchText("ÉCOLE Æsop Straße")).toBe("ecole aesop strasse");
    expect(nodeText(<p>a <b>b {1}</b>{false}{null}</p>).replace(/\s+/g, " ").trim()).toBe("a b 1");
  });

  it("is a labelled search with a live result count, opened through the product", async () => {
    const onOpen = vi.fn();
    render(
      <HelpProvider entries={entries} onOpen={onOpen}>
        <HelpSearch />
      </HelpProvider>,
    );
    expect(screen.getByRole("search", { name: "Search help" })).toBeTruthy();
    const field = screen.getByRole("searchbox", { name: "Search help" });
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    expect(field.getAttribute("aria-describedby")).toBe(status.id);
    await userEvent.type(field, "approval");
    expect(status.textContent).toBe("Results: 2");
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Approvals"]);
    expect(screen.getByRole("button", { name: "Budget" })).toBeTruthy();
    await userEvent.click(links[0]);
    expect(onOpen).toHaveBeenCalledWith("flow.approval", entries["flow.approval"]);
    await userEvent.clear(field);
    await userEvent.type(field, "zzz");
    expect(status.textContent).toBe("No help found. Try other or fewer words.");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("moves with the arrow keys and empties the field with Escape", async () => {
    render(
      <HelpProvider entries={entries} onOpen={() => undefined}>
        <HelpSearch defaultQuery="appro" />
      </HelpProvider>,
    );
    const field = screen.getByRole("searchbox");
    field.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent).toBe("Approvals");
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent).toBe("Budget");
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent).toBe("Budget");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(document.activeElement).toBe(field);
    await userEvent.keyboard("{Escape}");
    expect((field as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("follows only safe links and shows entries without a link or product handler as text", async () => {
    render(
      <UiTextProvider locale="de">
        <HelpProvider entries={{ a: { title: "Alpha", summary: "x", href: "javascript:alert(1)" } }}>
          <HelpSearch defaultQuery="alpha" />
        </HelpProvider>
      </UiTextProvider>,
    );
    expect(screen.getByRole("searchbox", { name: "Hilfe durchsuchen" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Ergebnisse: 1");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Alpha").tagName).toBe("STRONG");
  });
});
