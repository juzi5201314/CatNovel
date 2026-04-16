# Agent Transcript Persistence Design

## Goal

- Define one canonical transcript model for pi-mono agent sessions without changing current production writes yet.
- Persist only replayable conversation facts: `user`, `assistant`, and `toolResult`.
- Keep streaming and runtime coordination events transient so the database stores stable state, not transport noise.

## Existing Constraints

- `lib/contracts/agent-events.ts` exposes transport events such as `ai_chunk`, `ai_tool_call`, `ai_tool_result`, `ai_complete`, and internal state events.
- `lib/contracts/workspace.ts` and `lib/server/repositories/chat-repository.ts` currently persist chat history through `chat_messages` with roles limited to `user` and `assistant`.
- Existing `chat_messages` rows cannot safely represent tool metadata because they have no structured payload columns and `ChatRole` does not include `tool`.

## Canonical Persistence Decision

- Persist `user` messages: yes. They are user intent and must survive reload/retry.
- Persist `assistant` messages: yes. Persist only the final assistant text for a turn, not intermediate chunks.
- Persist `toolResult` messages: yes. Tool execution changes the semantic transcript and must be replayable for future turns.
- Persist `toolCall` messages: no standalone row. Keep the call transient until a matching result arrives, then fold call args into the durable `tool` entry metadata.
- Persist `ai_chunk`, `ai_state`, `ai_message_snapshot`, `ai_start`, `ai_error`: no. These are runtime or UI transport states, not canonical conversation facts.

## Write Timing

- `user`: write immediately after the request is accepted, same as current `chat_messages` behavior.
- `assistant`: buffer during streaming and write once on `ai_complete` using the final text.
- `toolResult`: write on `ai_tool_result`; merge the previously seen `ai_tool_call` args into the same row metadata.
- Failed assistant runs: do not create a final assistant transcript entry from `ai_error`; keep the error as transient runtime state unless product requirements later add explicit error history.

## Tool Result Strategy

- Keep `ai_tool_call` in memory keyed by `toolCallId`.
- When `ai_tool_result` arrives, create one durable `tool` transcript entry.
- Store `toolName`, `toolCallId`, serialized `toolArgs`, serialized `toolResult`, and `isError` on that entry.
- This avoids dangling call rows when a run is aborted and preserves enough data to replay or audit a tool-assisted turn.

## Database Recommendation

- Keep `chat_sessions` as the session container.
- Keep `chat_messages` as a compatibility read model for current UI and non-agent chat flows.
- Add a new canonical table `agent_transcript_entries` for transcript persistence instead of overloading `chat_messages`.
- During migration, use dual write:
  - write `user` and `assistant` to both `chat_messages` and `agent_transcript_entries`
  - write `toolResult` only to `agent_transcript_entries`
- After transcript-aware readers land, `chat_messages` can remain as a denormalized compatibility view or be retired later in a dedicated migration.

## Proposed Schema

The design-only SQL proposal lives in `db/migrations/0004_agent_transcript_persistence.sql` and is intentionally not registered in `db/schema.ts` yet.

Table shape:

- `id`: transcript entry id
- `session_id`: foreign key to `chat_sessions`
- `message_id`: agent turn/message correlation id from canonical events
- `sequence_number`: stable in-session ordering
- `role`: `user` | `assistant` | `tool`
- `content`: normalized text body
- `tool_call_id`, `tool_name`: nullable tool metadata
- `tool_args_json`, `tool_result_json`: structured payloads for tool entries
- `is_error`: marks tool failures without inventing a new role
- `source_event_types_json`: records which canonical events produced the row
- `created_at`: durable write timestamp

## Why A New Table

- `chat_messages.role` is tied to `ChatRole` and does not admit `tool`.
- `chat_messages` has no room for structured tool payloads.
- Reusing `chat_messages` would force either lossy stringification or a breaking `ChatRole` expansion across existing UI code.
- A new table isolates agent transcript semantics while preserving current app behavior.

## Type Contract

The design contract lives in `lib/contracts/agent-transcript.ts`.

- `AgentTranscript`: full session transcript with durable entries plus known transient states.
- `TranscriptEntry`: one canonical row with `isPersistent` / `persistToDatabase` markers for QA and migration wiring.
- `TranscriptPersistenceConfig`: default policy for what gets stored and when.

## Migration Scope For Future Implementation

- Add repository helpers for `agent_transcript_entries`.
- Wire agent runtime to accumulate tool call args until `ai_tool_result`.
- Keep current `appendChatMessage()` path for compatibility until transcript readers ship.
- Only after transcript readers are stable, decide whether `chat_messages` becomes a projection or remains first-class.
