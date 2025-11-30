# SQLRooms Query Workbench

This application is an example demonstrating the capabilities of SQLRooms for building powerful, "Local First" data applications.

This application showcases several key features:

- **Local First & Offline Support**: It is designed to work completely offline.
- **Installable as a PWA**: The application can be installed as a Progressive Web App for a more native experience.
- **OPFS Storage**: It uses the Origin Private File System (OPFS) for persistent and private data storage directly in the browser.

To enable powerful, in-browser analytics, this application bundles DuckDB-WASM. To ensure offline availability, some of its core extensions are downloaded during the `postinstall` step.
