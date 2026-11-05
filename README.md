# AI Runtime Governance — Web App

AI Runtime Governance is a governance service for AI agents. It checks prompts
before they reach a model and records the activity that follows, so a person can
see what was checked, what the agent did, and where something went wrong.

This repository contains the web app. It is the screen where you manage your
account, review your agents' activity, and respond to prompts that need your
approval.

## What you can do

- Create an account and protect it with an authenticator.
- Sign in and stay signed in on your own browser.
- Browse your private traces.
- Open one trace and read its activity in order.
- See whether a prompt was allowed, denied, redacted, or paused for approval.
- Approve or reject a prompt that belongs to you.
- See where activity is missing instead of being shown a false complete picture.
- Change your password, replace your authenticator, or generate new recovery
  codes.

## Who it is for

- **People using supported AI agents** who want to review what happened in a
  session.
- **The person who submitted a prompt** when the guard pauses it for approval.
- **Account owners** managing their own sign-in and recovery settings.

Host operators use a separate local administration tool. The web app does not
provide a public admin area for other people's accounts or traces.

## Opening the app

Use the address provided by your deployment operator in a current web browser.
No separate installation is needed.

Navigation is hidden by default. Select the menu icon in the top-left corner to
open the sidebar and access the pages available to your account. Close it with
the close icon, Escape, or by selecting outside the sidebar. Selecting a page
also closes the sidebar.

If the app cannot reach the governance service, it shows a session-loading error
with a retry action instead of pretending you are signed out or showing an empty
account.

## First-time setup

### 1. Create your account

Open the registration page and enter your email address and a password.

Passwords must be at least 12 characters. Passphrases are welcome, and password
managers may fill or paste them.

The confirmation message is intentionally generic: it does not reveal whether an
address already has an account.

### 2. Verify your email

Open the verification link sent to your email address. The link is single-use and
expires. If it no longer works, request a new one.

### 3. Set up your authenticator

Scan the QR code or enter the manual key into an authenticator app such as Google
Authenticator or Microsoft Authenticator. Enter the current six-digit code.

The setup key and your recovery codes are shown once. Save the recovery codes
before you continue.

### 4. Keep your recovery codes

You receive ten single-use recovery codes. Each code can stand in for your
authenticator once. Store them offline and separately from your password.

Generating a new set later revokes the previous set.

### 5. Sign in

Sign in with your email address, password, and current authenticator code. An
unused recovery code can replace the authenticator code.

After sign-in, you stay signed in on that browser for up to 30 days, or until
7 days pass without activity. Signing out, a password reset, account disablement,
or session expiry ends access.

## Before activity appears

Creating an account does not automatically allow an agent to use the deployment's
model gateway. A host operator grants that permission separately.

Activity appears when:

- your account has gateway access;
- a supported agent is connected to the gateway;
- the agent or its hooks report activity; and
- the service has stored the trace.

An account without gateway access can still sign in and manage its security
settings, but it will not produce guarded model activity.

## Using the activity page

Open **Activity** from the main navigation.

### Choose a trace

The left side lists your recent traces. A trace represents one monitored request
and the activity linked to it. Each row shows:

- when the service received it;
- whether execution is running, completed, failed, canceled, or unknown;
- whether telemetry is complete, incomplete, unknown, or unsupported;
- the prompt-guard outcome, if one was reported.

Select a trace to open its summary and timeline.

You can also open a trace directly with a link such as `/activity/<trace-id>`.
A direct link works only for the account that owns the trace.

### Read the summary

The summary tells you:

- the reported identity, when available;
- execution status;
- telemetry status;
- prompt-guard outcome;
- server receipt time;
- what the integration could observe for input, model response, and tools;
- any reported telemetry loss.

**Coverage** is reported separately for input, response, and tools. A session may
be guarded at the input but unsupported for tool activity, for example. The app
does not turn partial coverage into a full-coverage claim.

### Read the timeline

Events are shown in server receipt order within their parent group. Each event
has a kind, such as prompt, guard, approval, agent, model, or tool.

You will see:

- when the service received the event;
- the producer-reported source time, when available;
- duration, when reported;
- status;
- applicable rule, policy, or approval identifiers;
- whether the event is nested, unlinked, or has a parent that is not loaded on
  the current page.

**Not reported** means the producer did not provide a value. **Unavailable**
means the detail exists in the trace but is not available to this view. The app
does not guess either value.

### Load more or refresh

A page contains at most 50 traces or 200 events. Use **Load more** to continue
through the current list. New records do not shift the list you are already
reading.

Use **Refresh** to start again and see newly committed activity. The app does not
poll in the background.

## Understanding a guard result

| Result | What it means to you |
| :--- | :--- |
| **Allow** | No enabled guard rule blocked the prompt. |
| **Deny** | The prompt was blocked. |
| **Redact** | Sensitive text was replaced with a typed marker before forwarding. |
| **Require approval** | The prompt is paused until you decide. |
| **No guard outcome reported** | The timeline has no guard result for this trace. It may have bypassed the gateway or used an integration that does not report one. |

A clean guard result is not a promise that the entire conversation is safe. The
guard checks the newly submitted message, not hidden reasoning or later model
output.

## Approving a prompt

When the guard pauses a prompt, the submitting person sees an approval request.

1. Review the exact prompt and the reason it was paused.
2. Approve it to allow the redacted prompt to be forwarded.
3. Reject it to stop the request.

Approval rules:

- Only the person who submitted the prompt can decide.
- Approval applies to that exact message, not to later prompts.
- Redaction happens before approval; you are approving the redacted version.
- If you cancel or the request expires, the prompt is not forwarded.
- Reading approval history later does not approve anything.
- The app cannot resume a canceled request; the prompt must be submitted again
  for a fresh guard decision.

## Account and security settings

### Change your password

Changing your password requires a fresh confirmation with your password and a
second factor. Other sessions are signed out, and your current session continues
with its original expiry limit.

### Replace your authenticator

Replacing a lost authenticator requires a fresh confirmation with your password
and a second factor: your current authenticator or an unused recovery code. Your
old authenticator keeps working until the replacement is completed.

Complete the replacement by entering a code from the new authenticator and
confirming that you saved the new recovery codes.

### Generate new recovery codes

New codes become active only after you confirm that you saved them. The previous
unused codes stop working at that point. Your authenticator is not changed.

### Step-up confirmation

If a sensitive action needs a fresh check, the app opens a confirmation dialog.
Enter your password and current authenticator or recovery code. The original
action continues after confirmation.

## Privacy

- Your traces are private to your account.
- Another account cannot open your trace, even with a direct link.
- The timeline does not show prompt bodies, model outputs, tool inputs/outputs,
  hidden reasoning, or credentials.
- Approval requests are visible only to the person who submitted the prompt.
- Host operators can manage accounts and gateway access, but do not gain access
  to your private activity through those actions.
- The browser never calls a model provider directly.

## Troubleshooting

**The app says it cannot load your session**  
The backend may be unavailable, or your session may have ended. Check your
connection and retry. If retrying does not help, sign in again.

**You are sent to sign-in unexpectedly**  
Your session may have expired, been revoked by a password reset, or been ended by
an account disablement. Sign in with your password and second factor.

**You cannot see an activity item**  
The trace may belong to another account, may not have been committed yet, or the
integration may not report that event. A missing event is not proof that nothing
happened.

**A value says “Not reported”**  
The producer did not supply that value. The app deliberately avoids filling in a
guess such as zero or the current time.

**A value says “Unavailable”**  
The event is known, but its details are not available in this view.

**A trace says telemetry is incomplete**  
The integration could not report every event it was responsible for. Check the reported cause
and any known missing count or time range.

**You cannot approve a prompt**  
Approval is limited to the submitting person and the exact live request. If the
request expired or was cancelled, it cannot be approved. Submit the prompt again
for a new decision.

**A password reset signed you out everywhere**  
That is intentional. A reset revokes existing sessions. Sign in again with the new
password and your authenticator or an unused recovery code.

## What this app does not do

- It does not show prompt, model-response, or tool payloads.
- It does not show or reconstruct private hidden reasoning.
- It does not approve prompts from approval history.
- It does not let one person approve another person's prompt.
- It does not provide a public account or trace admin area.
- It does not call model providers directly.
- It does not provide workspace management, per-tool governance, or output
  scanning in the first release.

## Learn more

The product requirements, contracts, and design material live in the sibling
`../ai-runtime-governance` repository:

- `README.md` — product direction and scope
- `REQUIREMENTS.md` — Phase 1 requirements
- `TECHNICAL_BASELINE.md` — architecture baseline
- `contracts/` — authentication and timeline contracts
- `specs/` — native-auth and activity-timeline plans
