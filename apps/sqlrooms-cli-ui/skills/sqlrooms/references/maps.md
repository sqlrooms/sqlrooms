# Maps

Use `block-document.add-map-block` with `blockDocumentId`, `tableName`, `title`,
`reasoning`, and `config`. The operation creates the owned document block and map
resource together. It can update an existing map when given its `mapId`.

For longitude/latitude points, configure a named dataset and a layer binding:

```json
{
  "datasets": {"points": {"source": {"tableName": "schema.table"}}},
  "spec": {
    "layers": [
      {
        "@@type": "GeoArrowScatterplotLayer",
        "_sqlroomsBinding": {
          "dataset": "points",
          "longitudeColumn": "longitude",
          "latitudeColumn": "latitude"
        }
      }
    ]
  },
  "fitToData": {
    "dataset": "points",
    "longitudeColumn": "longitude",
    "latitudeColumn": "latitude"
  }
}
```

Replace the example reference and field names with the discovered schema.
SQLRooms normalizes the point binding. Prefer structured bindings to handwritten
geometry SQL. Preserve the returned resource ID, and inspect it with
`block-document.inspect-block` using `artifactId` and the document `blockId`
(not the map resource ID). Its `backingState` contains the map configuration.
