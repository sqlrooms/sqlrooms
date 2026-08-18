# SQLRooms Domain Context

This glossary records domain terms that define architectural ownership. It is
intentionally small and should grow only when a term carries design meaning.

## AI sessions

### Session chat controller

An ephemeral, per-session controller around the AI SDK chat. It owns live
streaming subscriptions, client-tool timers, and idle-watchdog timers. The AI
slice owns controller creation and disposal; React hooks only subscribe to it.
Controller state is never persisted.

### Session state

The inspectable, portable AI-session data stored in the AI slice configuration,
including messages, model selection, run context, and running state. Session
state remains usable when no chat UI is mounted.
