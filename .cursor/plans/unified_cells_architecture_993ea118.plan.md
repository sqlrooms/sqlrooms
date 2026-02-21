---
name: Unified Cells Architecture
overview: Refactor @sqlrooms/cells to be the canonical source for cell definitions, execution engine, and status storage. Notebook and Canvas become thin "view adapters" that store only view-specific metadata (layout, order, positions) and render the shared cells.
todos:
  - id: cells-schemas
    content: Move/unify cell schemas (sql, text, vega, input) into @sqlrooms/cells with a single CellSchema discriminated union
    status: completed
  - id: cells-slice
    content: "Create createCellsSlice in @sqlrooms/cells that owns: cells record, cellStatus record, addCell, removeCell, updateCell, runCell, cancelCell"
    status: completed
  - id: cells-execution
    content: Unify SQL execution logic into a shared executeSqlCell helper that both views call, with configurable schema name
    status: completed
  - id: notebook-refactor
    content: Refactor NotebookSlice to store only view meta (cellOrder, inputBarOrder, showInputBar, tabs) and delegate cell CRUD/execution to CellsSlice
    status: completed
  - id: canvas-refactor
    content: Refactor CanvasSlice to store only view meta (positions, edges, viewport, nodeOrder) and delegate cell CRUD/execution to CellsSlice
    status: completed
  - id: dag-update
    content: Update createDagSlice to work with the unified CellsSlice config
    status: completed
  - id: example-app
    content: Update notebook example to include both slices and add Canvas view toggle alongside Notebook/List
    status: completed
---

# Unified Cells Architecture

## Architecture Overview

```mermaid
flowchart TB
    subgraph cells_pkg ["@sqlrooms/cells"]
        CellSchemas["Cell Schemas<br/>sql, text, vega, input"]
        CellsSlice["createCellsSlice<br/>cells, cellStatus, execution"]
        DagSlice["createDagSlice<br/>dependencies, cascade"]
        SqlHelpers["SQL Helpers<br/>render, findDeps, run"]
        CellUI["Cell UI Components<br/>SqlCellBody, etc."]
    end

    subgraph notebook_pkg ["@sqlrooms/notebook"]
        NotebookSlice["createNotebookSlice<br/>cellOrder, tabs, inputBar"]
        NotebookUI["Notebook UI<br/>CellContainer, TabsBar"]
    end

    subgraph canvas_pkg ["@sqlrooms/canvas"]
        CanvasSlice["createCanvasSlice<br/>positions, edges, viewport"]
        CanvasUI["Canvas UI<br/>ReactFlow, nodes"]
    end

    subgraph app ["Example App Store"]
        Store["Combined Store"]
    end

    CellsSlice --> Store
    NotebookSlice --> Store
    CanvasSlice --> Store
    DagSlice --> CellsSlice









```