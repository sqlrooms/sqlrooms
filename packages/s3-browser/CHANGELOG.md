# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.24.16 (2025-08-27)

### Features

* Add to DataTable: estimated rowCount, create table DDL and comment ([#127](https://github.com/sqlrooms/sqlrooms/issues/127)) ([13a6a7f](https://github.com/sqlrooms/sqlrooms/commit/13a6a7fb3f95ffd66c20bf6beec816bf225fdc91))

## 0.24.15 (2025-08-27)

**Note:** Version bump only for package @sqlrooms/s3-browser

## 0.24.14 (2025-08-21)

### Features

* support connect to proxy llm server ([#116](https://github.com/sqlrooms/sqlrooms/issues/116)) ([ac3fef2](https://github.com/sqlrooms/sqlrooms/commit/ac3fef21731cb1f6484fe4d96f1a5791070e1e26))

## 0.24.13 (2025-08-21)

### Features

* AI assistant rendering improvements ([#117](https://github.com/sqlrooms/sqlrooms/issues/117)) ([59023d9](https://github.com/sqlrooms/sqlrooms/commit/59023d95f2effdb78bf2706e819c30f275335572))

## 0.24.12 (2025-08-21)

### Bug Fixes

* Fewer keywords in completion ([#106](https://github.com/sqlrooms/sqlrooms/issues/106)) ([e386b7d](https://github.com/sqlrooms/sqlrooms/commit/e386b7da6663ccef52807362b57804b88111276f))

## 0.24.11 (2025-08-07)

### Bug Fixes

* splitFilePath to support both Windows and Unix path separators ([#108](https://github.com/sqlrooms/sqlrooms/issues/108)) ([eb19a12](https://github.com/sqlrooms/sqlrooms/commit/eb19a123d9a21ccdfb6da0c61100979fab33ea56))

## 0.24.10 (2025-07-29)

### Bug Fixes

* Set variable doesn't work in SqlEditor ([#103](https://github.com/sqlrooms/sqlrooms/issues/103)) ([5f7ef67](https://github.com/sqlrooms/sqlrooms/commit/5f7ef67cc63dafbdfbe4bf826a9fbe059d6a993f))

## 0.24.9 (2025-07-28)

### Features

* allow user input ollama model name; style think in markdown ([#89](https://github.com/sqlrooms/sqlrooms/issues/89)) ([6a3805e](https://github.com/sqlrooms/sqlrooms/commit/6a3805eed256ad672df3e029dbff601cb32512f2))

## 0.24.8 (2025-07-28)

### Bug Fixes

* Incorrect DataTableModal import ([#101](https://github.com/sqlrooms/sqlrooms/issues/101)) ([c6c4548](https://github.com/sqlrooms/sqlrooms/commit/c6c4548aa597ad1a9622701d67fc11e731e00343))

## 0.24.7 (2025-07-28)

### Bug Fixes

* Optional viewTableModal in defaultRenderTableNodeMenuItems ([#100](https://github.com/sqlrooms/sqlrooms/issues/100)) ([5b8c2f4](https://github.com/sqlrooms/sqlrooms/commit/5b8c2f47f1752de2fbfb9e6b41fb4c339da31876))

## 0.24.6 (2025-07-28)

### Bug Fixes

* Create table initial query wasn't properly set ([#99](https://github.com/sqlrooms/sqlrooms/issues/99)) ([c95ca58](https://github.com/sqlrooms/sqlrooms/commit/c95ca58c64fa17a8eff4e2bad683bb9b50f26e94))

## 0.24.5 (2025-07-25)

### Bug Fixes

* SQL editor function suggestions backward compatibility ([#97](https://github.com/sqlrooms/sqlrooms/issues/97)) ([cc08dee](https://github.com/sqlrooms/sqlrooms/commit/cc08dee7bf0a73a6cbbaaff3f5bc0fc128c049d5))

## 0.24.4 (2025-07-23)

### Bug Fixes

* Memoize function suggestions in SqlMonacoEditor to avoid infinite loop ([#95](https://github.com/sqlrooms/sqlrooms/issues/95)) ([5860d45](https://github.com/sqlrooms/sqlrooms/commit/5860d45be538ba5ba7660d881b97a24e9702c592))

## 0.24.3 (2025-07-20)

### Bug Fixes

* Less restrictive duckdb dep ([#93](https://github.com/sqlrooms/sqlrooms/issues/93)) ([fe05299](https://github.com/sqlrooms/sqlrooms/commit/fe05299569f57f74af6d1d1729fcae22eaf6a456))

## 0.24.2 (2025-07-20)

### Bug Fixes

* Incorrect duckdb dependency version ([#91](https://github.com/sqlrooms/sqlrooms/issues/91)) ([487cef4](https://github.com/sqlrooms/sqlrooms/commit/487cef41747a9819610c3540c55ce45e97815eb4))

## 0.24.1 (2025-07-20)

### Bug Fixes

* Monaco editor errors in Next.js ([#90](https://github.com/sqlrooms/sqlrooms/issues/90)) ([6d15902](https://github.com/sqlrooms/sqlrooms/commit/6d15902dacd89d6f0620649c555f1243a69dafb5))

# 0.24.0 (2025-07-15)

### Features

* Add fileDataSourceLoader to enable file data sources ([#88](https://github.com/sqlrooms/sqlrooms/issues/88)) ([57813af](https://github.com/sqlrooms/sqlrooms/commit/57813af571fee946d548f6eb965184fbab386454))

# 0.23.0 (2025-07-10)

### Features

* SQL editor completion improvements ([#87](https://github.com/sqlrooms/sqlrooms/issues/87)) ([e4097a5](https://github.com/sqlrooms/sqlrooms/commit/e4097a53af8b0fced356eb7258a391ee587d9e75))

# 0.22.0 (2025-07-09)

### Features

* Slice initialization improvements ([#86](https://github.com/sqlrooms/sqlrooms/issues/86)) ([dace87e](https://github.com/sqlrooms/sqlrooms/commit/dace87e5a58408b21be752cb374c7c5cc2d1af11))

# 0.21.0 (2025-07-06)

### Features

* Add MotherDuck WASM connector ([#85](https://github.com/sqlrooms/sqlrooms/issues/85)) ([4777803](https://github.com/sqlrooms/sqlrooms/commit/47778039fb9ab8a8d7441d3f5d7e12f7669534d4))

# 0.20.0 (2025-06-26)

### Features

* Upgrade open assistant ([#82](https://github.com/sqlrooms/sqlrooms/issues/82)) ([95687a2](https://github.com/sqlrooms/sqlrooms/commit/95687a2fe392f7dc2866eda458675040b18b84b7))

## 0.19.2 (2025-06-23)

**Note:** Version bump only for package @sqlrooms/s3-browser

## 0.19.1 (2025-06-23)

### Bug Fixes

* Update mosaic deps ([#81](https://github.com/sqlrooms/sqlrooms/issues/81)) ([9e98841](https://github.com/sqlrooms/sqlrooms/commit/9e98841fc3a2f580dcb5a415f511e1565b3b5414))

# 0.19.0 (2025-06-23)

### Features

* Package reorg, LayoutSlice ([#80](https://github.com/sqlrooms/sqlrooms/issues/80)) ([05bb8a9](https://github.com/sqlrooms/sqlrooms/commit/05bb8a93e7f220374cafb84e2c3cc8d7ab8e3c33))

## 0.18.1 (2025-06-20)

### Bug Fixes

* Added missing dep ([#75](https://github.com/sqlrooms/sqlrooms/issues/75)) ([3a931b0](https://github.com/sqlrooms/sqlrooms/commit/3a931b042eebe824e159e4686e93b2407a80c85b))

# 0.18.0 (2025-06-19)

### Features

* QueryHandle is now PromiseLike ([#74](https://github.com/sqlrooms/sqlrooms/issues/74)) ([1ac4467](https://github.com/sqlrooms/sqlrooms/commit/1ac44676ca47ecbaf2e8bdee9bac1f64e86ede2d))

# 0.17.0 (2025-06-16)

### Features

* Code terminology update: renaming project* to room* ([#70](https://github.com/sqlrooms/sqlrooms/issues/70)) ([f28307f](https://github.com/sqlrooms/sqlrooms/commit/f28307f02e6ea6ac079c8a7d02f01f4925dd168a))

## 0.16.4 (2025-06-14)

**Note:** Version bump only for package @sqlrooms/s3-browser

## 0.16.3 (2025-06-14)

### Bug Fixes

* camelCaseToTitle uppercase handling ([#56](https://github.com/sqlrooms/sqlrooms/issues/56)) ([1d3b6f0](https://github.com/sqlrooms/sqlrooms/commit/1d3b6f0ed29c8961d5092b8609f7abd13c32001e))

## 0.16.2 (2025-06-11)

### Bug Fixes

* Pin apache-arrow to 17 to align with duckdb-wasm ([#68](https://github.com/sqlrooms/sqlrooms/issues/68)) ([dcf973d](https://github.com/sqlrooms/sqlrooms/commit/dcf973de4ba975a326f778509766169faf3ac4b7))

## 0.16.1 (2025-06-11)

### Bug Fixes

* DuckDbSlice: Table schemas loading omitted database and schema ([#67](https://github.com/sqlrooms/sqlrooms/issues/67)) ([8157a9a](https://github.com/sqlrooms/sqlrooms/commit/8157a9ac3367c22643b1af9304f5314e85760a80))

# 0.16.0 (2025-06-10)

### Features

* SqlEditor improvements and schema tree ([#45](https://github.com/sqlrooms/sqlrooms/issues/45)) ([3ca951d](https://github.com/sqlrooms/sqlrooms/commit/3ca951d3115132266414b8cd6302c24d1f95d301))

# 0.15.0 (2025-05-29)

### Features

* Adding more components to ui module ([#64](https://github.com/sqlrooms/sqlrooms/issues/64)) ([b26cca1](https://github.com/sqlrooms/sqlrooms/commit/b26cca1b7c6c9b3bd962715b912e72a0282de655))

# 0.14.0 (2025-05-26)

### Features

* Add `@sqlrooms/discuss` providing basic commenting slice and UI ([#60](https://github.com/sqlrooms/sqlrooms/issues/60)) ([d386bcf](https://github.com/sqlrooms/sqlrooms/commit/d386bcff02cc546bdf39ac63345ff7ebbb9cdb30))

## 0.13.2 (2025-05-23)

### Bug Fixes

* monaco editor force rerender when update theme ([#62](https://github.com/sqlrooms/sqlrooms/issues/62)) ([4851220](https://github.com/sqlrooms/sqlrooms/commit/485122096f3af7a0fe2ab03d146cd3f1e1574528))

## 0.13.1 (2025-05-18)

### Bug Fixes

* String escaping in literalToSQL ([#54](https://github.com/sqlrooms/sqlrooms/issues/54)) ([80b5cae](https://github.com/sqlrooms/sqlrooms/commit/80b5caef259e92e9ba6bede0e4296d07f2a95b09))

# 0.13.0 (2025-05-13)

### Features

* Adding execute and queryJson to DuckDbConnector ([#52](https://github.com/sqlrooms/sqlrooms/issues/52)) ([816a067](https://github.com/sqlrooms/sqlrooms/commit/816a0670e6b363374fb99ba6a62bf2ac9630702f))

# 0.12.0 (2025-04-23)

### Features

* support dropdown actions in table card ([#46](https://github.com/sqlrooms/sqlrooms/issues/46)) ([31f5db1](https://github.com/sqlrooms/sqlrooms/commit/31f5db1ea9dc4b2ada8327a62d354afe3149d769))

# 0.11.0 (2025-04-09)

### Features

* Added RadioGroup to ui module ([#43](https://github.com/sqlrooms/sqlrooms/issues/43)) ([71e2a0f](https://github.com/sqlrooms/sqlrooms/commit/71e2a0f26c48299ee83e014afef01e29c4933546))

## 0.10.1 (2025-04-08)

**Note:** Version bump only for package @sqlrooms/s3-browser

# 0.10.0 (2025-04-08)

**Note:** Version bump only for package @sqlrooms/s3-browser

## <small>0.9.3 (2025-04-03)</small>

## <small>0.9.2 (2025-04-01)</small>

## <small>0.9.1 (2025-04-01)</small>

# [0.9.0](https://github.com/sqlrooms/sqlrooms/compare/v0.8.1...v0.9.0) (2025-03-31)

**Note:** Version bump only for package @sqlrooms/s3-browser

## [0.8.1](https://github.com/sqlrooms/sqlrooms/compare/v0.8.0...v0.8.1) (2025-03-10)

**Note:** Version bump only for package @sqlrooms/s3-browser

# [0.8.0](https://github.com/sqlrooms/sqlrooms/compare/v0.7.0...v0.8.0) (2025-03-10)

**Note:** Version bump only for package @sqlrooms/s3-browser

# [0.7.0](https://github.com/sqlrooms/sqlrooms/compare/v0.6.0...v0.7.0) (2025-03-01)

**Note:** Version bump only for package @sqlrooms/s3-browser

# [0.6.0](https://github.com/sqlrooms/sqlrooms/compare/v0.5.1...v0.6.0) (2025-02-26)

**Note:** Version bump only for package @sqlrooms/s3-browser

## [0.5.1](https://github.com/sqlrooms/sqlrooms/compare/v0.5.0...v0.5.1) (2025-02-25)

**Note:** Version bump only for package @sqlrooms/s3-browser

# [0.5.0](https://github.com/sqlrooms/sqlrooms/compare/v0.4.2...v0.5.0) (2025-02-24)

**Note:** Version bump only for package @sqlrooms/s3-browser

## [0.4.2](https://github.com/sqlrooms/sqlrooms/compare/v0.4.0...v0.4.2) (2025-02-23)

**Note:** Version bump only for package @sqlrooms/s3-browser

## [0.4.1](https://github.com/sqlrooms/sqlrooms/compare/v0.4.0...v0.4.1) (2025-02-21)

**Note:** Version bump only for package @sqlrooms/s3-browser

# [0.4.0](https://github.com/sqlrooms/sqlrooms/compare/v0.3.0...v0.4.0) (2025-02-21)

**Note:** Version bump only for package @sqlrooms/s3-browser

# [0.3.0](https://github.com/sqlrooms/sqlrooms/compare/v0.1.0...v0.3.0) (2025-02-13)

**Note:** Version bump only for package @sqlrooms/s3-browser

# [0.2.0](https://github.com/sqlrooms/sqlrooms/compare/v0.1.0...v0.2.0) (2025-02-13)

**Note:** Version bump only for package @sqlrooms/s3-browser

# [0.1.0](https://github.com/sqlrooms/sqlrooms/compare/v0.0.3...v0.1.0) (2025-02-10)

**Note:** Version bump only for package @sqlrooms/s3-browser

## [0.0.3](https://github.com/sqlrooms/sqlrooms/compare/v0.0.2...v0.0.3) (2025-02-06)

**Note:** Version bump only for package @sqlrooms/s3-browser

## [0.0.2](https://github.com/sqlrooms/sqlrooms/compare/v0.0.1...v0.0.2) (2025-02-03)

### Reverts

- Revert "chore(release): publish v0.0.2" ([6c00184](https://github.com/sqlrooms/sqlrooms/commit/6c00184595ac6be08424751e297880d1ed013364))

## [0.0.1](https://github.com/ilyabo/sqlrooms/compare/v0.0.1-alpha.0...v0.0.1) (2025-01-30)

**Note:** Version bump only for package @sqlrooms/s3-browser

## 0.0.1-alpha.0 (2025-01-30)

**Note:** Version bump only for package @sqlrooms/s3-browser

**Note:** Version bump only for package @sqlrooms/s3-browser
