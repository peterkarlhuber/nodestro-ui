// @nodestro/ui-ai behaviour: the approval card decides nothing by itself, explains why a decision is blocked, and
// hands the comment and the remembered choice to the product; the other components show their data safely.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type LiHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiTextProvider } from "@nodestro/ui-core";
import {
  ApprovalCard,
  CONFIRM_REJECT_MS,
  ChatMessage,
  DEFAULT_REMEMBER,
  RememberOptions,
  SourceList,
  ToolCallRow,
  domainOf,
  formatCountdown,
  rememberComplete,
  safeHref,
  type ApprovalCardProps,
  type RememberChoice,
} from "@nodestro/ui-ai";

afterEach(cleanup);

function card(props: Partial<ApprovalCardProps> = {}) {
  const onApprove = vi.fn();
  const onReject = vi.fn();
  render(<ApprovalCard title="mailer" onApprove={onApprove} onReject={onReject} {...props} />);
  return {
    onApprove,
    onReject,
    approve: () => screen.getByRole("button", { name: "Approve" }),
    reject: () => screen.getByRole("button", { name: "Reject" }),
  };
}

describe("ApprovalCard", () => {
  it("is an article named after what waits, with the kind, context, instructions and what to review", () => {
    card({
      kind: "step",
      title: "Check the offer",
      context: "Offers · waiting since 10:00",
      instructions: "Look at the prices.",
      children: <p>Result</p>,
    });
    const article = screen.getByRole("article", { name: "Approval: Check the offer" });
    expect(article.textContent).toContain("A step waits for your approval");
    expect(article.textContent).toContain("Offers · waiting since 10:00");
    expect(article.textContent).toContain("Look at the prices.");
    expect(within(article).getByText("Result")).toBeTruthy();
  });

  it("says when there is nothing to review and shows a tool call's exact arguments", () => {
    card();
    expect(screen.getByText("There is nothing to review.")).toBeTruthy();
    cleanup();
    card({ kind: "tool", arguments: { to: "a@example.org", subject: "Offer" } });
    const code = screen.getByLabelText("Arguments");
    expect(code.tagName).toBe("PRE");
    expect(JSON.parse(code.textContent ?? "")).toEqual({ to: "a@example.org", subject: "Offer" });
    expect(code.tabIndex).toBe(0);
  });

  it("approves and rejects with the comment; nothing happens without a click", async () => {
    const { onApprove, onReject, approve, reject } = card({ allowComment: true });
    expect(onApprove).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Comment"), "  looks fine ");
    await userEvent.click(approve());
    expect(onApprove).toHaveBeenCalledWith({ comment: "looks fine", remember: null });
    await userEvent.click(reject());
    expect(onReject).toHaveBeenCalledWith({ comment: "looks fine", remember: null });
  });

  it("needs a comment to reject when asked, and says so next to the button", async () => {
    const { onReject, reject } = card({ allowComment: true, requireCommentOnReject: true });
    // Blocked, but focusable so the reason can be reached (aria-disabled, described by the reason); a press does nothing.
    expect(reject().getAttribute("aria-disabled")).toBe("true");
    expect((reject() as HTMLButtonElement).disabled).toBe(false);
    const reason = document.getElementById(reject().getAttribute("aria-describedby") ?? "");
    expect(reason?.textContent).toBe("Write a comment to reject.");
    await userEvent.click(reject());
    expect(onReject).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Comment (required to reject)")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Comment (required to reject)"), "wrong recipient");
    expect(reject().getAttribute("aria-disabled")).toBeNull();
    expect((reject() as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(reject());
    expect(onReject).toHaveBeenCalledWith({ comment: "wrong recipient", remember: null });
  });

  it("counts down and blocks both decisions when the time is up", () => {
    const { approve, reject } = card({ secondsLeft: 125 });
    expect(screen.getByText("2:05 left to decide")).toBeTruthy();
    cleanup();
    const late = card({ secondsLeft: 0 });
    expect(screen.getByText("The time to decide has passed; the request counts as rejected.")).toBeTruthy();
    expect((late.approve() as HTMLButtonElement).disabled).toBe(true);
    expect((late.reject() as HTMLButtonElement).disabled).toBe(true);
    expect(approve).toBeDefined();
    expect(reject).toBeDefined();
  });

  it("shows the decision being sent as busy and blocks the other one", () => {
    const { approve, reject } = card({ pending: "approve" });
    expect(approve().getAttribute("aria-busy")).toBe("true");
    expect((approve() as HTMLButtonElement).disabled).toBe(true);
    expect((reject() as HTMLButtonElement).disabled).toBe(true);
  });

  it("remembers a decision only when a rule is chosen and complete", async () => {
    const { onApprove, onReject, approve, reject } = card({ kind: "tool", rememberAgent: "wf_1/writer" });
    expect(screen.getByRole("group", { name: "Remember this decision" })).toBeTruthy();
    await userEvent.click(approve());
    expect(onApprove).toHaveBeenLastCalledWith({ comment: "", remember: null });
    await userEvent.selectOptions(screen.getByLabelText("How long"), "until");
    await userEvent.selectOptions(screen.getByLabelText("For whom"), "all");
    expect((approve() as HTMLButtonElement).disabled).toBe(true);
    expect((reject() as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById(approve().getAttribute("aria-describedby") ?? "")?.textContent).toBe("Choose an end date first.");
    await userEvent.type(screen.getByLabelText("Ends on"), "2030-01-31T12:00");
    await userEvent.click(reject());
    expect(onReject).toHaveBeenLastCalledWith({
      comment: "",
      remember: { duration: "until", scope: "all", until: "2030-01-31T12:00" },
    });
  });

  it("never remembers approving what may only be rejected, but remembers rejecting it", async () => {
    const { onApprove, onReject, approve, reject } = card({
      kind: "tool",
      rememberAgent: "wf_1/writer",
      rejectOnly: "destructive",
    });
    await userEvent.selectOptions(screen.getByLabelText("How long"), "until_revoked");
    expect(screen.getByText(/only rejecting can be remembered/)).toBeTruthy();
    expect(screen.getByRole("option", { name: "This agent (wf_1/writer)" })).toBeTruthy();
    await userEvent.click(approve());
    expect(onApprove).toHaveBeenLastCalledWith({ comment: "", remember: null });
    await userEvent.click(reject());
    expect(onReject).toHaveBeenLastCalledWith({
      comment: "",
      remember: { duration: "until_revoked", scope: "agent", until: "" },
    });
    // An incomplete rule blocks only rejecting then: approving remembers nothing anyway.
    await userEvent.selectOptions(screen.getByLabelText("How long"), "until");
    expect((approve() as HTMLButtonElement).disabled).toBe(false);
    expect((reject() as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the product's error as an alert", () => {
    card({ error: "The decision came too late." });
    expect(screen.getByRole("alert").textContent).toBe("The decision came too late.");
  });

  it("speaks the product's language and takes the product's own texts", () => {
    render(
      <UiTextProvider locale="de" translate={(key) => (key === "ai.approval.approve" ? "Diesen Aufruf erlauben" : undefined)}>
        <ApprovalCard kind="budget" title="Lauf 7" onApprove={() => {}} onReject={() => {}} />
      </UiTextProvider>,
    );
    expect(screen.getByRole("article", { name: "Freigabe: Lauf 7" }).textContent).toContain("Ein Lauf wartet auf eine Budgetentscheidung");
    expect(screen.getByRole("button", { name: "Diesen Aufruf erlauben" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ablehnen" })).toBeTruthy();
  });

  it("formats the countdown", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5)).toBe("0:00");
    expect(formatCountdown(61.9)).toBe("1:01");
    expect(formatCountdown(3600)).toBe("60:00");
  });
});

describe("ApprovalCard for a product's own cards", () => {
  it("takes the product's name and attributes", () => {
    card({
      title: "Freigabe",
      label: "Approval: Freigabe · Offers · 10:00",
      "data-testid": "step-approval",
      id: "card-1",
    });
    const article = screen.getByRole("article", { name: "Approval: Freigabe · Offers · 10:00" });
    expect(article.getAttribute("data-testid")).toBe("step-approval");
    expect(article.id).toBe("card-1");
  });

  it("places the product's own fields after the comment", () => {
    card({ allowComment: true, extra: <label>Note to the agent<textarea /></label> });
    const comment = screen.getByLabelText("Comment");
    const note = screen.getByLabelText("Note to the agent");
    expect(comment.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("lets the product hold the remembered choice and block an incomplete rule for its own reasons", async () => {
    function Controlled({ known }: { known: boolean }) {
      const [value, setValue] = useState<RememberChoice>(DEFAULT_REMEMBER);
      return (
        <ApprovalCard
          kind="tool"
          title="mailer"
          rememberAgent="writer"
          remember={value}
          onRememberChange={setValue}
          rememberIncomplete={!known && value.scope === "agent"}
          onApprove={onApprove}
          onReject={onReject}
        />
      );
    }
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const { rerender } = render(<Controlled known={false} />);
    // This call only: nothing to complete.
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByLabelText("How long"), "until_revoked");
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<Controlled known />);
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenLastCalledWith({
      comment: "",
      remember: { duration: "until_revoked", scope: "agent", until: "" },
    });
  });
});

describe("ApprovalCard with a rejection that cannot be undone", () => {
  afterEach(() => vi.useRealTimers());

  it("rejects only on a second press, on the button that takes focus", async () => {
    const { onReject, reject } = card({ kind: "budget", confirmReject: true });
    await userEvent.click(reject());
    expect(onReject).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Really reject?" });
    expect(document.activeElement).toBe(confirm);
    await userEvent.click(confirm);
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith({ comment: "", remember: null });
    expect(screen.queryByRole("button", { name: "Really reject?" })).toBeNull();
  });

  it("undoes the first press with Escape, which stays in the card, and focus goes back", async () => {
    const onOuterKey = vi.fn();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <div onKeyDown={(event) => onOuterKey(event.key)}>
        <ApprovalCard title="run" confirmReject onApprove={onApprove} onReject={onReject} />
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Really reject?" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reject" }));
    expect(onOuterKey).not.toHaveBeenCalledWith("Escape");
    expect(onReject).not.toHaveBeenCalled();
  });

  it("undoes the first press when focus leaves", async () => {
    const { onReject, reject } = card({ confirmReject: true });
    await userEvent.click(reject());
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.queryByRole("button", { name: "Really reject?" })).toBeNull();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("undoes the first press when the time runs out", () => {
    vi.useFakeTimers();
    const { onReject, reject } = card({ confirmReject: true });
    fireEvent.click(reject());
    expect(screen.getByRole("button", { name: "Really reject?" })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(CONFIRM_REJECT_MS - 1));
    expect(screen.getByRole("button", { name: "Really reject?" })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByRole("button", { name: "Really reject?" })).toBeNull();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("rejects at once without confirmReject", async () => {
    const { onReject, reject } = card();
    await userEvent.click(reject());
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});

describe("ApprovalCard around its decisions", () => {
  it("shows a help next to the decisions and the product's footer under them", () => {
    card({
      actionsHelp: <button type="button">What ending does</button>,
      footer: <p>Raised twice before</p>,
    });
    const actions = screen.getByRole("button", {
      name: "Reject",
    }).parentElement!;
    expect(within(actions).getByRole("button", { name: "What ending does" })).toBeTruthy();
    const footer = screen.getByText("Raised twice before");
    expect(actions.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("read-only shows what waits without any way to decide", () => {
    card({
      readOnly: true,
      allowComment: true,
      rememberAgent: "wf/a",
      extra: <p>Own field</p>,
      rejectHint: "Ends the run.",
      children: <p>Facts</p>,
    });
    expect(screen.getByRole("article", { name: "Approval: mailer" })).toBeTruthy();
    expect(screen.getByText("Facts")).toBeTruthy();
    expect(screen.getByText("Own field")).toBeTruthy();
    expect(screen.getByText("Ends the run.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByLabelText("How long")).toBeNull();
  });
});

function RememberHarness({ onChange }: { onChange?: (value: RememberChoice) => void }) {
  const [value, setValue] = useState(DEFAULT_REMEMBER);
  return (
    <RememberOptions
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      agent="wf/a"
      data-testid="remember"
    >
      <p data-testid="own-note">Own note</p>
    </RememberOptions>
  );
}

describe("RememberOptions", () => {
  it("offers this call only by default, then scope and end date as needed", async () => {
    const onChange = vi.fn();
    render(<RememberHarness onChange={onChange} />);
    const group = screen.getByTestId("remember");
    expect(group.tagName).toBe("FIELDSET");
    expect(within(group).getAllByRole("option").map((o) => o.textContent)).toEqual(["This call only", "Until revoked", "Until a date"]);
    expect(screen.queryByLabelText("For whom")).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText("How long"), "until_revoked");
    expect(screen.getByLabelText("For whom")).toBeTruthy();
    expect(screen.queryByLabelText("Ends on")).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText("How long"), "until");
    expect(screen.getByLabelText("Ends on").getAttribute("type")).toBe("datetime-local");
    expect(onChange).toHaveBeenLastCalledWith({ duration: "until", scope: "agent", until: "" });
    expect(screen.getByTestId("own-note")).toBeTruthy();
    expect(rememberComplete({ duration: "until", scope: "agent", until: "" })).toBe(false);
    expect(rememberComplete({ duration: "until_revoked", scope: "agent", until: "" })).toBe(true);
  });
});

describe("ToolCallRow", () => {
  it("names the call, says its status in words and hides details behind a disclosure", async () => {
    render(<ToolCallRow name="web_search" status="awaiting_approval" duration="1.2 s" summary="3 results" arguments={{ q: "x" }} result="ok" />);
    const row = screen.getByRole("group", { name: "Tool call web_search" });
    expect(row.textContent).toContain("Waiting for approval");
    expect(row.textContent).toContain("took 1.2 s");
    const toggle = within(row).getByRole("button", { name: /Details/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(toggle);
    expect(JSON.parse(row.querySelector("pre")?.textContent ?? "")).toEqual({ q: "x" });
    expect(within(row).getByText("ok")).toBeTruthy();
  });

  it("has no disclosure without details", () => {
    render(<ToolCallRow name="t" status="succeeded" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Done")).toBeTruthy();
  });
});

describe("ChatMessage", () => {
  it("is an article named after its author, keeps line breaks of text and marks streaming", () => {
    render(
      <ChatMessage role="assistant" status="streaming" time={{ iso: "2026-11-21T10:00:00Z", text: "10:00" }}>
        {"Line one\nLine two"}
      </ChatMessage>,
    );
    const message = screen.getByRole("article", { name: "Message from Assistant" });
    expect(message.getAttribute("aria-busy")).toBe("true");
    expect(message.querySelector("time")?.getAttribute("dateTime")).toBe("2026-11-21T10:00:00Z");
    expect(screen.getByText("Writing…")).toBeTruthy();
    expect(message.querySelector("p")?.textContent).toBe("Line one\nLine two");
  });

  it("links only safe attachments and announces an error", () => {
    render(
      <ChatMessage
        role="user"
        author="Ada"
        status="error"
        attachments={[
          { name: "offer.pdf", href: "/files/1", size: "12 KB" },
          { name: "evil.html", href: "javascript:alert(1)" },
        ]}
      >
        Hello
      </ChatMessage>,
    );
    expect(screen.getByRole("article", { name: "Message from Ada" })).toBeTruthy();
    const list = screen.getByRole("list", { name: "Attachments" });
    expect(within(list).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/files/1"]);
    expect(within(list).getByText("evil.html").tagName).toBe("SPAN");
    expect(screen.getByRole("alert").textContent).toBe("The answer could not be completed.");
  });
});

describe("SourceList", () => {
  it("shows titles as text and links only http(s), in a new tab without a referrer", () => {
    render(
      <SourceList
        sources={[
          {
            id: "S1",
            title: "<b>Bold</b> <script>alert(1)</script>",
            url: "https://www.example.org/a",
            badge: <span>found</span>,
          },
          { id: "S2", title: "Bad", url: "javascript:alert(1)" },
          { id: "S3", title: " ", url: "https://docs.example.com/p", meta: "10:00" },
        ]}
      />,
    );
    const region = screen.getByRole("region", { name: "Sources" });
    const links = within(region).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe("<b>Bold</b> <script>alert(1)</script> (opens in a new tab)");
    expect(region.querySelector("b, script")).toBeNull();
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer");
    expect(region.textContent).toContain("example.org");
    expect(links[1].textContent).toContain("https://docs.example.com/p");
    expect(region.textContent).toContain("docs.example.com · 10:00");
    expect(within(region).getByText("Bad").tagName).toBe("SPAN");
    expect(safeHref("ftp://x")).toBeNull();
    expect(safeHref("/a", true)).toBe("/a");
    expect(safeHref("//a", true)).toBeNull();
    expect(domainOf("not a url")).toBe("");
  });

  it("says when there are no sources", () => {
    render(<SourceList sources={[]} title="Web sources" level={2} />);
    expect(screen.getByRole("heading", { level: 2, name: "Web sources" })).toBeTruthy();
    expect(screen.getByText("No sources.")).toBeTruthy();
  });
});

describe("ToolCallRow for a product's own lists", () => {
  it("names the status in the product's words, as text, with its icon, details and attributes", () => {
    render(
      <ToolCallRow
        name="mailer"
        status="failed"
        statusText="Error · 10:02 · 1.2 s"
        icon={<svg data-testid="icon" />}
        arguments={{ to: "a@example.org" }}
        details={<p>From the MCP server mail</p>}
        result={<pre>timeout</pre>}
        data-testid="call"
        defaultOpen
      />,
    );
    const row = screen.getByRole("group", { name: "Tool call mailer" });
    expect(row.getAttribute("data-testid")).toBe("call");
    expect(within(row).getByText("Error · 10:02 · 1.2 s").className).toContain("ui-tool-call__status--danger");
    expect(within(row).queryByText("Failed")).toBeNull();
    expect(screen.getByTestId("icon").parentElement?.getAttribute("aria-hidden")).toBe("true");
    const texts = [...row.querySelectorAll("pre, p")].map((element) => element.textContent);
    expect(texts.indexOf("From the MCP server mail")).toBeGreaterThan(texts.findIndex((text) => text?.includes("a@example.org")));
    expect(texts.indexOf("timeout")).toBeGreaterThan(texts.indexOf("From the MCP server mail"));
  });

  it("can be one disclosure: the line opens the arguments, the result and the note", async () => {
    render(<ToolCallRow name="web_search" status="succeeded" disclosure arguments={{ q: "x" }} result="3 hits" note={<span>Approved by Anna</span>} />);
    const row = screen.getByRole("group", { name: "Tool call web_search" });
    expect(row.tagName).toBe("DETAILS");
    expect((row as HTMLDetailsElement).open).toBe(false);
    expect(row.querySelector("summary")?.textContent).toContain("web_search");
    expect(screen.queryByRole("button", { name: "Details" })).toBeNull();
    await userEvent.click(row.querySelector("summary")!);
    expect((row as HTMLDetailsElement).open).toBe(true);
    expect(within(row).getByText("3 hits")).toBeTruthy();
    expect(within(row).getByText("Approved by Anna")).toBeTruthy();
  });
});

describe("ChatMessage for a product's own conversation", () => {
  it("takes an avatar, its own name and attributes, and may leave out the author line", () => {
    render(
      <ChatMessage role="assistant" avatar={<svg data-testid="avatar" />} label="Answer" hideHead data-testid="answer" data-status="succeeded">
        Hello
      </ChatMessage>,
    );
    const message = screen.getByRole("article", { name: "Answer" });
    expect(message.getAttribute("data-testid")).toBe("answer");
    expect(message.getAttribute("data-status")).toBe("succeeded");
    expect(screen.getByTestId("avatar").parentElement?.getAttribute("aria-hidden")).toBe("true");
    expect(message.querySelector("header")).toBeNull();
    expect(screen.queryByText("Assistant")).toBeNull();
    expect(within(message).getByText("Hello")).toBeTruthy();
  });

  it("says in the product's words what is being done while it is written", () => {
    render(
      <ChatMessage role="assistant" status="streaming" statusLine={<p role="status">Searching the knowledge base</p>}>
        Hel
      </ChatMessage>,
    );
    expect(screen.getByRole("article").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Searching the knowledge base");
    expect(screen.queryByText("Writing…")).toBeNull();
    cleanup();
    render(
      <ChatMessage role="assistant" status="streaming" statusLine={null}>
        Hel
      </ChatMessage>,
    );
    expect(screen.getByRole("article").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("Writing…")).toBeNull();
  });
});

describe("SourceList for a product's own pages", () => {
  it("passes attributes to the list and to each source, and can show nothing when empty", () => {
    const { rerender, container } = render(
      <SourceList
        sources={[{ id: "S1", title: "A", url: "https://example.org/a" }]}
        aria-label="Web sources"
        data-testid="sources"
        itemProps={(source) => ({ "data-testid": `source-${source.id}` } as LiHTMLAttributes<HTMLLIElement>)}
      />,
    );
    expect(screen.getByTestId("sources").tagName).toBe("SECTION");
    expect(screen.getByTestId("source-S1").className).toBe("ui-sources__item");
    // The link's name keeps the space before the hidden "(opens in a new tab)".
    expect(screen.getByRole("link", { name: "A (opens in a new tab)" })).toBeTruthy();
    rerender(<SourceList sources={[]} hideEmpty />);
    expect(container.innerHTML).toBe("");
  });
});

describe("links that could leave the site (open redirect)", () => {
  const OUTSIDE = ["//evil.example", "/\\evil.example", "\\\\evil.example", "/\t/evil.example", "/\r\n/evil.example", "/x\u0000y", "https://evil.example/\\x"];
  it("are refused by safeHref, also where in-app paths are allowed", () => {
    for (const href of OUTSIDE) {
      expect(safeHref(href, true), JSON.stringify(href)).toBeNull();
      expect(safeHref(href), JSON.stringify(href)).toBeNull();
    }
    expect(safeHref("/files/1", true)).toBe("/files/1");
    expect(safeHref("/files/1")).toBeNull();
  });

  it("never become a link in a chat attachment or a source", () => {
    render(
      <>
        <ChatMessage role="user" attachments={[{ name: "a", href: "/\\evil.example" }]}>x</ChatMessage>
        <SourceList sources={[{ id: "S1", title: "b", url: "/\\evil.example" }]} />
      </>,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});
