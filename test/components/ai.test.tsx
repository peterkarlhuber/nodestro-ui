// @nodestro/ui-ai behaviour: the approval card decides nothing by itself, explains why a decision is blocked, and
// hands the comment and the remembered choice to the product; the other components show their data safely.
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiTextProvider } from "@nodestro/ui-core";
import {
  ApprovalCard,
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
  return { onApprove, onReject, approve: () => screen.getByRole("button", { name: "Approve" }), reject: () => screen.getByRole("button", { name: "Reject" }) };
}

describe("ApprovalCard", () => {
  it("is an article named after what waits, with the kind, context, instructions and what to review", () => {
    card({ kind: "step", title: "Check the offer", context: "Offers · waiting since 10:00", instructions: "Look at the prices.", children: <p>Result</p> });
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
    expect((reject() as HTMLButtonElement).disabled).toBe(true);
    const reason = document.getElementById(reject().getAttribute("aria-describedby") ?? "");
    expect(reason?.textContent).toBe("Write a comment to reject.");
    expect(screen.getByLabelText("Comment (required to reject)")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Comment (required to reject)"), "wrong recipient");
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
    expect(onReject).toHaveBeenLastCalledWith({ comment: "", remember: { duration: "until", scope: "all", until: "2030-01-31T12:00" } });
  });

  it("never remembers approving what may only be rejected, but remembers rejecting it", async () => {
    const { onApprove, onReject, approve, reject } = card({ kind: "tool", rememberAgent: "wf_1/writer", rejectOnly: "destructive" });
    await userEvent.selectOptions(screen.getByLabelText("How long"), "until_revoked");
    expect(screen.getByText(/only rejecting can be remembered/)).toBeTruthy();
    expect(screen.getByRole("option", { name: "This agent (wf_1/writer)" })).toBeTruthy();
    await userEvent.click(approve());
    expect(onApprove).toHaveBeenLastCalledWith({ comment: "", remember: null });
    await userEvent.click(reject());
    expect(onReject).toHaveBeenLastCalledWith({ comment: "", remember: { duration: "until_revoked", scope: "agent", until: "" } });
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
          { id: "S1", title: "<b>Bold</b> <script>alert(1)</script>", url: "https://www.example.org/a", badge: <span>found</span> },
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
