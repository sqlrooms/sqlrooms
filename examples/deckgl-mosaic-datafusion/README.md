### [Mosaic + DataFusion-WASM + Zarr](https://sqlrooms-deckgl-mosaic-datafusion.netlify.app/)

[Try live](https://sqlrooms-deckgl-mosaic-datafusion.netlify.app/)
| [GitHub repo](https://github.com/sqlrooms/sqlrooms/tree/main/examples/deckgl-mosaic-datafusion)

<video src="https://sqlrooms.org/media/examples/sqlrooms-deckgl-mosaic-datafusion-example.mp4" aria-label="SQLRooms Deck.gl, Mosaic, and DataFusion example app preview" width="450" controls loop muted>Preview of the SQLRooms Deck.gl, Mosaic, and DataFusion example app.</video>

This example ports [Gjore Milevski](https://github.com/dzole0311)'s
[mosaic-datafusion-zarr-deckgl](https://github.com/dzole0311/mosaic-datafusion-zarr-deckgl)
experiment (read the [original write-up](https://gjoremilevski.com/posts/mosaic-datafusion-zarr-deckgl/))
into the SQLRooms shell, alongside the [Deck.gl + Mosaic example](https://github.com/sqlrooms/examples/tree/main/deckgl-mosaic)
it is structurally closest to.

ECMWF IFS ENS temperature is streamed client-side from a public Zarr store
([dynamical.org](https://dynamical.org)) with zarrita, queried with
[DataFusion compiled to WASM](https://github.com/apache/datafusion) through a
Mosaic crossfilter, and rendered with
[@developmentseed/deck.gl-zarr](https://github.com/developmentseed/deck.gl-raster).

This room is hand-composed from the base room, layout, Mosaic, and forecast
slices. It does not include SQLRooms' DuckDB slice, so loading the example does
not initialize or download DuckDB-WASM. Its full query path is:

```text
Mosaic clients → supplied Mosaic Coordinator → DataFusion connector → DataFusion-WASM
```

The DataFusion-WASM wrapper's `query({type, sql})` method already matches
Mosaic's `Connector` interface. It returns
[flechette](https://github.com/uwdata/flechette) tables directly because that
is what DataFusion's Arrow IPC output decodes into, so the wrapper is handed to
the supplied `Coordinator` as-is. Room shell chrome (sidebar, theme, layout
panels), the map, the raster shaders, and the crossfilter hooks are otherwise
unchanged from the source app.

Because the Coordinator can only be built once the DataFusion tables exist
(which needs the first streamed Zarr chunk), the room store here is not a
static module export like other examples' `store.ts`; it's built by
`createForecastRoomStore(lab)` once boot finishes, see `src/App.tsx`.

The DataFusion-WASM bindings ship with `execute_ipc`, `register_ipc` and
`materialize_table`, which the published upstream package doesn't have, so
this example depends on
[`@dzole0311/datafusion-wasm`](https://www.npmjs.com/package/@dzole0311/datafusion-wasm),
a patched build published from
[dzole0311/datafusion-wasm-bindings](https://github.com/dzole0311/datafusion-wasm-bindings)
(a fork of [datafusion-contrib/datafusion-wasm-bindings](https://github.com/datafusion-contrib/datafusion-wasm-bindings)).

#### Running locally

Build the workspace packages first, then run this example:

```sh
pnpm build
pnpm dev deckgl-mosaic-datafusion-example
```
