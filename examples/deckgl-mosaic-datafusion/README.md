### Mosaic crossfilter with DataFusion-WASM and Zarr, rendered with deck.gl

This example ports [Gjore Milevski](https://github.com/dzole0311)'s
[mosaic-datafusion-zarr-deckgl](https://github.com/dzole0311/mosaic-datafusion-zarr-deckgl)
experiment (write-up [here](https://gjoremilevski.com/posts/mosaic-datafusion-zarr-deckgl/))
into the SQLRooms shell, alongside the [deckgl-mosaic](../deckgl-mosaic) example
it is structurally closest to.

ECMWF IFS ENS temperature is streamed client-side from a public Zarr store
([dynamical.org](https://dynamical.org)) with zarrita, queried with
[DataFusion compiled to WASM](https://github.com/apache/datafusion) through a
Mosaic crossfilter, and rendered with
[@developmentseed/deck.gl-zarr](https://github.com/developmentseed/deck.gl-raster).

`@sqlrooms/mosaic`'s `createMosaicSlice()` normally builds its Mosaic
`Coordinator` from the room's DuckDB-WASM connector. It also accepts an
already-built `Coordinator` (see `packages/mosaic/src/MosaicSlice.ts`), which
is the extension point this example uses instead: the DataFusion-WASM
wrapper's `query({type, sql})` method already matches Mosaic's `Connector`
interface (it returns [flechette](https://github.com/uwdata/flechette)
tables directly, since that's what DataFusion's Arrow IPC output decodes
into), so it is handed to `Coordinator` as-is. Room shell chrome (sidebar,
theme, layout panels), the map, the raster shaders, and the crossfilter
hooks are otherwise unchanged from the source app.

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
