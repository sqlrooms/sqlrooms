# SQLRooms AI Sub-Agents demo app

Example demonstrating nested sub-agent orchestration with the core AI module. A single top-level **travel planner** agent delegates to three sub-agents:

- **Weather agent** — retrieves weather forecasts and converts temperatures
- **Activities agent** — suggests attractions and upcoming events
- **Hotel booking agent** — searches for hotels and books rooms (with user approval via `needsApproval`)

For a simpler single-agent example, see [examples/ai-agent](../ai-agent/).

[More about SQLRooms examples](https://sqlrooms.org/examples/)

# Running locally

Run the following:

    npm install
    npm dev
