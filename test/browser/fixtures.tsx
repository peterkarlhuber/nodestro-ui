// What the browser checks render: every component in its main states.
import { Badge, Button, Collapsible, ConfirmIconButton, ErrorHelp, Field, HelpProvider, HelpSearch, HelpTip, IconButton, ListDetail, Select, TextArea, TextInput, Tooltip } from "@nodestro/ui-core";
import { ApprovalCard, ChatMessage, RememberOptions, SourceList, ToolCallRow } from "@nodestro/ui-ai";

const noop = () => {};
const HELP = {
  entries: {
    "flow.approval": { title: "Approvals", summary: "A step that waits for a person.", href: "/docs/approvals" },
    "flow.budget": { title: "Budget", summary: "What a run may spend; an approval can raise it." },
  },
  errors: { "approval.expired": "flow.approval" },
};

/** The approval card of the acceptance criterion: a tool call with arguments, badges, deadline, comment and rules. */
export function ApprovalFixture() {
  return (
    <HelpProvider {...HELP}>
      <ApprovalCard
        kind="tool"
        title="mailer"
        context="Offers › Write the offer · waiting since 10:00"
        help={<HelpTip id="flow.approval" />}
        badges={
          <>
            <Badge tone="warning">Writes</Badge>
            <Badge tone="warning">External</Badge>
          </>
        }
        arguments={{ to: "customer@example.org", subject: "Your offer" }}
        secondsLeft={754}
        allowComment
        requireCommentOnReject
        rememberAgent="wf_1/writer"
        rejectHint="Rejecting ends the call; the agent is told."
        onApprove={noop}
        onReject={noop}
      />
    </HelpProvider>
  );
}

export function Gallery() {
  return (
    <HelpProvider {...HELP}>
      <ApprovalFixture />
      <ApprovalCard kind="step" title="Check the offer" instructions="Look at the prices." onApprove={noop} onReject={noop}>
        <Collapsible title="Offer draft" defaultOpen>
          <p>Total: 1,200 EUR</p>
        </Collapsible>
      </ApprovalCard>
      <ApprovalCard kind="budget" title="Run 7" secondsLeft={0} error="The decision came too late." onApprove={noop} onReject={noop}>
        <p>Spent 4.80 of 5.00 EUR; the next request can cost up to 0.40 EUR.</p>
      </ApprovalCard>
      <ApprovalCard kind="tool" title="delete_files" pending="approve" rememberAgent="wf_1/cleaner" rejectOnly="destructive" onApprove={noop} onReject={noop} arguments={{ path: "/tmp/x" }} />
      <RememberOptions value={{ duration: "until", scope: "all", until: "2030-01-31T12:00" }} onChange={noop} agent="wf_1/writer" rejectOnly="mcp" />
      <ToolCallRow name="web_search" status="succeeded" duration="1.2 s" summary="3 results" arguments={{ q: "offers" }} result="3 pages" defaultOpen />
      <ToolCallRow name="mailer" status="awaiting_approval" />
      <ToolCallRow name="reader" status="failed" note="Denied by a rule" />
      <ChatMessage role="user" author="Ada" time={{ iso: "2026-11-21T10:00:00Z", text: "10:00" }} attachments={[{ name: "offer.pdf", href: "/files/1", size: "12 KB" }]}>
        {"Please write the offer.\nKeep it short."}
      </ChatMessage>
      <ChatMessage role="assistant" status="streaming">
        Here is a draft
      </ChatMessage>
      <ChatMessage role="tool" status="error">
        web_search
      </ChatMessage>
      <SourceList
        sources={[
          { id: "S1", title: "Offer guide", url: "https://www.example.org/a", meta: "10:00", badge: <Badge tone="success">Read</Badge> },
          { id: "S2", title: "Not a link", url: "javascript:alert(1)", badge: <Badge tone="idle">Found</Badge> },
        ]}
        hint="Every page the tools saw."
      />
      <div>
        <Button variant="primary">Save</Button> <Button>Cancel</Button> <Button variant="danger">Delete</Button> <Button variant="ghost">More</Button>{" "}
        <Button busy>Saving</Button> <Button disabled>Disabled</Button> <IconButton label="Settings" icon={<span>⚙</span>} />{" "}
        <ConfirmIconButton label="Delete run" icon={<span>✕</span>} onConfirm={noop} />{" "}
        {/* The armed step of a ConfirmIconButton, as its first press shows it. */}
        <Button size="sm" variant="danger" icon={<span>✕</span>} className="ui-confirm-button" aria-label="Delete run: Delete?">
          Delete?
        </Button>{" "}
        <Tooltip content="Runs once">
          <Button size="sm">Run</Button>
        </Tooltip>
      </div>
      <div>
        {(["neutral", "info", "success", "warning", "danger", "running", "idle"] as const).map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </div>
      <Field label="Name" hint="As others see it" required>
        <TextInput defaultValue="Offer" />
      </Field>
      <Field label="Description" error="Too long">
        <TextArea defaultValue="x" />
      </Field>
      <Field label="Colour">
        <Select value="red" onChange={noop} options={[{ value: "red", label: "Red" }]} />
      </Field>
      <Collapsible title="Advanced" summary="3 settings">
        <p>Hidden</p>
      </Collapsible>
      <ListDetail label="Workflows" items={[{ id: "a", label: "Offers", description: "3 steps" }, { id: "b", label: "Invoices" }]} selectedId="a" onSelect={noop} renderDetail={(item) => <p>Details of {item.id}</p>} />
      <ErrorHelp code="approval.expired">The time to decide has passed.</ErrorHelp>
      <HelpSearch defaultQuery="approval" />
    </HelpProvider>
  );
}
