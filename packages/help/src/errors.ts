// Which help entry explains which stable error code of the platform API. A key is a code family ("access.*": every
// code that starts with "access.") or an exact code; the exact code wins, then the longest family (see
// helpIdForError in @nodestro/ui-core). The repository's coverage test checks this map against the pinned list of
// API error codes (errors/api-error-codes.json): every code has help here or a listed exception
// (errors/exceptions.json), and every key here matches a code.

/** Error code family or exact code -> help entry id. */
export const HELP_ERRORS: Readonly<Record<string, string>> = {
  "access.*": "help.access",
  "apikey.*": "help.access",
  "auth.*": "help.access",
  "identity.*": "help.access",
  "pairing.*": "help.access",
  "token.*": "help.access",
  "ui.*": "help.access",

  "approval.*": "help.approvals",
  "tool_draft.*": "help.approvals",

  "budget.*": "help.budget",
  "limit.*": "help.budget",
  "pricing.*": "help.budget",

  "draft.*": "help.models",
  "model.*": "help.models",
  "model_choice.*": "help.models",
  "offline.*": "help.models",
  "provider.*": "help.models",
  provider_api: "help.models",

  "local.*": "help.localModels",

  "agent.*": "help.agents",
  "architect.*": "help.agents",
  "assistant.*": "help.agents",
  "conversation.*": "help.agents",
  "knowledge.*": "help.agents",
  "memory.*": "help.agents",
  "skill.*": "help.agents",

  "extension.*": "help.tools",
  "mcp.*": "help.tools",
  "mcp_server.*": "help.tools",
  "tool.*": "help.tools",

  "deps.*": "help.libraries",
  "job.*": "help.libraries",
  "sandbox.*": "help.libraries",

  "connection.*": "help.connections",
  "lan.*": "help.connections",
  "mail.*": "help.connections",
  "notifications.*": "help.connections",
  "notify.*": "help.connections",
  "sync.*": "help.connections",
  "webhook.*": "help.connections",

  "document.*": "help.files",
  "file.*": "help.files",
  "files.*": "help.files",
  "folder.*": "help.files",
  "fs.*": "help.files",
  "input.*": "help.files",
  "output.*": "help.files",
  "trace.*": "help.files",

  "check.*": "help.workflows",
  "config.*": "help.workflows",
  "form.*": "help.workflows",
  "library.*": "help.workflows",
  "preview.*": "help.workflows",
  "template.*": "help.workflows",
  "workflow.*": "help.workflows",

  "adopt.*": "help.runs",
  "batch.*": "help.runs",
  "benchmark.*": "help.runs",
  "report.*": "help.runs",
  "resume.*": "help.runs",
  "run.*": "help.runs",
  "run_chat.*": "help.runs",
  "runs.*": "help.runs",
  "schedule.*": "help.runs",
  "testcase.*": "help.runs",

  "api.*": "help.publishing",
  "export.*": "help.publishing",
  "gate.*": "help.publishing",
  "publication.*": "help.publishing",
  "release.*": "help.publishing",
  "version.*": "help.publishing",

  "backup.*": "help.backup",
  "recovery.*": "help.backup",
  "secrets.*": "help.backup",
  "storage.*": "help.backup",
  "workspace.*": "help.backup",

  bad_request: "help.requests",
  internal: "help.requests",
  not_found: "help.requests",
  "cors.*": "help.requests",
  "http.*": "help.requests",
  "idempotency.*": "help.requests",
  "method.*": "help.requests",
  "profile.*": "help.requests",
  "proxy.*": "help.requests",
  "request.*": "help.requests",
  "route.*": "help.requests",
  "settings.*": "help.requests",
};
