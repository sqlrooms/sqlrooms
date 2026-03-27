# Typescript and React Patterns

> When: writing or reviewing general typescript and react code

# General

- Prefer `Type[]` over `Array<Type>`
- Avoid patterns using `any` such as `as any`:
  - Use `isSqlCell`, `isTextCell`, `isVegaCell`, `isInputCell` to determine the cell type
  - Use existing or add new user defined guard functions to determine exact type of the union type and use docs if you need to research more: https://www.typescriptlang.org/docs/handbook/advanced-types.html
- Split long functions with high cyclomatic complexity into smaller functions for better readability

# React

- Use `React.FC` to strongly type components
- Prefer defining complex component props as separate `type` over defining inline

# Vega

- Use typings for Vega-specs

# es-toolkit

- Prefer utils from `es-toolkit` package over complex built-in functions chaining
