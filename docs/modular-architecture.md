# Modular Architecture

SQLRooms is designed with a modular architecture that allows developers to pick and choose exactly the functionality they need for their data analytics applications. This approach enables you to build custom solutions tailored to your specific requirements.

![SQLRooms Architecture](/media/overview/architecture.svg)

The diagram above illustrates how SQLRooms is structured for composability and extensibility:

- **Core packages** (green) provide the foundation: `roomShellStore` manages configuration and data sources, while `<RoomShell>` offers a flexible UI shell and panel layout. DuckDB-WASM and utilities enable fast, in-browser analytics.
- **Feature packages** (purple) are plug-and-play modules you can add as needed—such as DataTable views, SQL query editors, AI integration, Vega charts, S3 browser, and more. These integrate seamlessly with the core, letting you extend your app with popular data visualization and analytics tools.
- **Custom App Code** (blue) is where you bring it all together: use `roomStore` to compose base and custom store logic, and build your own custom views and panels. You can mix and match core and feature packages, or add your own, to create a tailored analytics experience.

A key part of SQLRooms' modularity is **store composability via slices**. Slices are modular pieces of state and logic that can be added to your Room. You can use slices from the `@sqlrooms/*` packages or create your own custom slices. Each slice is a function that returns a partial state object along with methods to modify that state. This makes it easy to extend and customize your Room's behavior.

Learn more and see an example in [Composing Store from Slices](/key-concepts#composing-store-from-slices).

This modular approach means you can start simple and grow your app as your needs evolve—adding only the components you want, and integrating with the libraries and tools your users need.
