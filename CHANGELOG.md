# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.27.0-rc.5](github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.4...v0.27.0-rc.5) (2026-02-14)

### Features

* room-store: expose bound useRoomStore API and add useRoomStoreApi hook ([#360](/github.com/sqlrooms/sqlrooms/issues/360)) ([c5b68a3](github.com/sqlrooms/sqlrooms/commits/c5b68a329c7134c1937927b53a7c39b0ac4f06ea))

# [0.27.0-rc.4](github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.3...v0.27.0-rc.4) (2026-02-11)

### Bug Fixes

* AI settings changes are only applied in new sessions ([#356](/github.com/sqlrooms/sqlrooms/issues/356)) ([d1799d0](github.com/sqlrooms/sqlrooms/commits/d1799d0ab503be3a872a8cda948fe50bac0bc60c))
* Avoid deckgl v8 type errors ([#351](/github.com/sqlrooms/sqlrooms/issues/351)) ([b3d5b88](github.com/sqlrooms/sqlrooms/commits/b3d5b887b27e12f83f0340294758cf23cc7f23bc))
* ColumnTypeBadge styling ([#350](/github.com/sqlrooms/sqlrooms/issues/350)) ([25dcd19](github.com/sqlrooms/sqlrooms/commits/25dcd194806c5ace4f5b30b2f562070131a79639))
* getKeplerFactory causing constant remounting ([#352](/github.com/sqlrooms/sqlrooms/issues/352)) ([bd2fbf0](github.com/sqlrooms/sqlrooms/commits/bd2fbf07485ae1ab1b545b36c82ee6f0c2467a5b))
* getKeplerFactory number of hook calls errors ([#354](/github.com/sqlrooms/sqlrooms/issues/354)) ([c52fa70](github.com/sqlrooms/sqlrooms/commits/c52fa70f15667959b72e63a065ac513f5084403b))
* Kepler injector improvements ([#349](/github.com/sqlrooms/sqlrooms/issues/349)) ([4a7295b](github.com/sqlrooms/sqlrooms/commits/4a7295b5120b2278422c04ce878520dfa8cfaaa4))

### Features

* AI: Ask for API key inline in chat input ([#357](/github.com/sqlrooms/sqlrooms/issues/357)) ([f256021](github.com/sqlrooms/sqlrooms/commits/f256021abb0b7f981d392f5e6d8c61e71e5eed09))
* make View Instructions optional ([#353](/github.com/sqlrooms/sqlrooms/issues/353)) ([7782c36](github.com/sqlrooms/sqlrooms/commits/7782c363951a72fdf1c158cd85f50cb4f36f6d9f))

# [0.27.0-rc.3](github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.2...v0.27.0-rc.3) (2026-02-05)

### Bug Fixes

* Ai suggestions div height ([24c2909](github.com/sqlrooms/sqlrooms/commits/24c290995519cecd17f6dab45f2229d059b720a5))
* chart label position and add responsive font size ([#328](/github.com/sqlrooms/sqlrooms/issues/328)) ([99c5099](github.com/sqlrooms/sqlrooms/commits/99c509950f48f0d3e8128f9704939e247fbc8f90))
* color utils get css color from theme mode ([#331](/github.com/sqlrooms/sqlrooms/issues/331)) ([caa4db9](github.com/sqlrooms/sqlrooms/commits/caa4db9def2c9c790905500940a03bbd95b60e1f))
* configureKeplerInjector factory resolving was happening early ([#326](/github.com/sqlrooms/sqlrooms/issues/326)) ([19b3b14](github.com/sqlrooms/sqlrooms/commits/19b3b1470462aa93e315bbc3619bf8a52a0e744f))
* eslint configuration ([#317](/github.com/sqlrooms/sqlrooms/issues/317)) ([24b8619](github.com/sqlrooms/sqlrooms/commits/24b8619f33b784bbe5b853b465cbde350209b8e0))
* fix tab reordering ([#340](/github.com/sqlrooms/sqlrooms/issues/340)) ([338b880](github.com/sqlrooms/sqlrooms/commits/338b880d5808d5df7e5b4fbac5fd41f73626dd51))
* monaco editor flashing ([#306](/github.com/sqlrooms/sqlrooms/issues/306)) ([35e4420](github.com/sqlrooms/sqlrooms/commits/35e4420f21360460ed4950043e0628ef82f5ff93)), closes [#313](github.com/sqlrooms/sqlrooms/issues/313)
* Prevent horizontal scrolling in TabStrip.SearchDropdown ([#341](/github.com/sqlrooms/sqlrooms/issues/341)) ([c574017](github.com/sqlrooms/sqlrooms/commits/c574017083591c36fbda4b00147fc7a5d2a4c73a))
* Prevent type errors in React 18 which don't have `inert` ([#323](/github.com/sqlrooms/sqlrooms/issues/323)) ([505498b](github.com/sqlrooms/sqlrooms/commits/505498b3b021bd72f4b278b95b3d986c0e73f708))
* rollback query panel ([#339](/github.com/sqlrooms/sqlrooms/issues/339)) ([f9efcd5](github.com/sqlrooms/sqlrooms/commits/f9efcd5cd319eb41cd3c75ea48da355b8304376b))
* TabStrip scroll into view ([#312](/github.com/sqlrooms/sqlrooms/issues/312)) ([271efcf](github.com/sqlrooms/sqlrooms/commits/271efcfea8c095703d4e05150d75b59144d62930))
* Vector tiles creating layers ([#325](/github.com/sqlrooms/sqlrooms/issues/325)) ([132ee22](github.com/sqlrooms/sqlrooms/commits/132ee229c4349679c3b681c9ce9e50d8d8aed851))

### Features

* Abort query in CreateTableForm ([#321](/github.com/sqlrooms/sqlrooms/issues/321)) ([ff16aad](github.com/sqlrooms/sqlrooms/commits/ff16aada806e60dc0f23e69d64668046d98ec087))
* AI open session tabs now saved in AI slice config ([#315](/github.com/sqlrooms/sqlrooms/issues/315)) ([34a33cb](github.com/sqlrooms/sqlrooms/commits/34a33cb1819275e3365aaf7c4607405ec6a2d663))
* Charts actions: only show on hover ([#336](/github.com/sqlrooms/sqlrooms/issues/336)) ([87a21ce](github.com/sqlrooms/sqlrooms/commits/87a21ce58bc15b09b790456bd8d1719416c3ae44))
* Configurable Kepler injector with custom recipe support ([#318](/github.com/sqlrooms/sqlrooms/issues/318)) ([2337ff4](github.com/sqlrooms/sqlrooms/commits/2337ff4c189dd6d2c9827edae4717e89fe7a30ea))
* enhance ErrorMessage component with customizable Markdown components ([#333](/github.com/sqlrooms/sqlrooms/issues/333)) ([ffe618a](github.com/sqlrooms/sqlrooms/commits/ffe618a9de8655de4bf18fcdf6df1c8f53cd8622))
* improve explain query output in sqleditor ([#308](/github.com/sqlrooms/sqlrooms/issues/308)) ([1557c4b](github.com/sqlrooms/sqlrooms/commits/1557c4be52c7198b55f28132cba1f10a31fa148b))
* Introduce ScrollableRow ([#337](/github.com/sqlrooms/sqlrooms/issues/337)) ([d1d90cc](github.com/sqlrooms/sqlrooms/commits/d1d90cc9a0b99ef7854b3501f882d4759117f6fe))
* Prompt suggestion improvements ([#316](/github.com/sqlrooms/sqlrooms/issues/316)) ([55eba6c](github.com/sqlrooms/sqlrooms/commits/55eba6cf7fcf449c9c88d9e058478c63959f7ec1))
* render reasoning in agent tool ([#322](/github.com/sqlrooms/sqlrooms/issues/322)) ([ffca82e](github.com/sqlrooms/sqlrooms/commits/ffca82eef19eb6d617a48ce3ee376e64987f747e))

# [0.27.0-rc.2](github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.1...v0.27.0-rc.2) (2026-01-22)

### Bug Fixes

* query result panels are mapped based on query tab id ([#304](/github.com/sqlrooms/sqlrooms/issues/304)) ([a3c6a83](github.com/sqlrooms/sqlrooms/commits/a3c6a83d2b567890496d4409a834e527afb1f89c))
* show chart as inline component in the sidebar ([#303](/github.com/sqlrooms/sqlrooms/issues/303)) ([a201c46](github.com/sqlrooms/sqlrooms/commits/a201c46e7504ef0fd0390f58ae5728dad8847b88))

### Features

* Add storeKey to createRoomStore ([#307](/github.com/sqlrooms/sqlrooms/issues/307)) ([c829bdb](github.com/sqlrooms/sqlrooms/commits/c829bdbabd71cdceac4afd818cbff405377e3cd0))
* Prepare sqlrooms-server for publishing ([#305](/github.com/sqlrooms/sqlrooms/issues/305)) ([d120996](github.com/sqlrooms/sqlrooms/commits/d120996cb3c5a02c36df048b5e79947c55140aa1))

# [0.27.0-rc.1](github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.0...v0.27.0-rc.1) (2026-01-17)

### Bug Fixes

* AI Fix tool error message layout ([#287](/github.com/sqlrooms/sqlrooms/issues/287)) ([660a7df](github.com/sqlrooms/sqlrooms/commits/660a7df8dfcd8a39e007ad8eb7e4e8d6e2bbeaff))
* Date and decimal types display incorrectly in data table ([#289](/github.com/sqlrooms/sqlrooms/issues/289)) ([41a5750](github.com/sqlrooms/sqlrooms/commits/41a575076874eccb04e2e4f787136bbe43ae7b6d))
* **deps:** update dependency react-vega to v8 ([#255](/github.com/sqlrooms/sqlrooms/issues/255)) ([fa352f4](github.com/sqlrooms/sqlrooms/commits/fa352f43b1ed32afce7ca9a8575ecd1205001d45))
* Dev-only: HMR store preservation utilities ([#294](/github.com/sqlrooms/sqlrooms/issues/294)) ([d0e73ad](github.com/sqlrooms/sqlrooms/commits/d0e73addf068b1216d6cb430d7deedbb6a0b6cbe))
* dynamic font class resolver ([#291](/github.com/sqlrooms/sqlrooms/issues/291)) ([7b11d21](github.com/sqlrooms/sqlrooms/commits/7b11d212e2ac930920c0779abe48899ebbd2a78b))
* query data table popover content format ([#288](/github.com/sqlrooms/sqlrooms/issues/288)) ([b1cd872](github.com/sqlrooms/sqlrooms/commits/b1cd872bb8839aa4631765824e4385762f589c57))
* schema tree row count alignment ([#295](/github.com/sqlrooms/sqlrooms/issues/295)) ([02f4395](github.com/sqlrooms/sqlrooms/commits/02f439557af647f024dfef0672d55000baaba255))
* timeline slider not showing for trip layer ([#276](/github.com/sqlrooms/sqlrooms/issues/276)) ([5c28903](github.com/sqlrooms/sqlrooms/commits/5c289033711d5d39a621f729ddd8788ae1740728))

### Features

* add custom value rendered for arrow table ([#292](/github.com/sqlrooms/sqlrooms/issues/292)) ([9e86149](github.com/sqlrooms/sqlrooms/commits/9e86149106cb8371739d5acaa88b943c7a3d06c9))
* add provider options to AiSlice ([#275](/github.com/sqlrooms/sqlrooms/issues/275)) ([f23a72b](github.com/sqlrooms/sqlrooms/commits/f23a72beef0008a410813861da50a2347355d144))
* AI: Support parallel sessions ([#284](/github.com/sqlrooms/sqlrooms/issues/284)) ([d5c6402](github.com/sqlrooms/sqlrooms/commits/d5c6402981341da9dec73d2b6da738a7d430f598))
* Kepler legend fixes ([#285](/github.com/sqlrooms/sqlrooms/issues/285)) ([809aaa8](github.com/sqlrooms/sqlrooms/commits/809aaa8b2b23dbda4802e1b22076abd94cd979b6))
* propagate the change to the arrow table to parent components ([#299](/github.com/sqlrooms/sqlrooms/issues/299)) ([0d6a335](github.com/sqlrooms/sqlrooms/commits/0d6a335fd770a90fa454d7f5d3a5f21aedb0e5d1))
* Remove delete chat message button ([#298](/github.com/sqlrooms/sqlrooms/issues/298)) ([b955820](github.com/sqlrooms/sqlrooms/commits/b9558201b6190e4802943eecc142e40550f8face))
* Vega actions toolbar ([#301](/github.com/sqlrooms/sqlrooms/issues/301)) ([ef68f2e](github.com/sqlrooms/sqlrooms/commits/ef68f2ef0b6c36855dbe247261cd7e4beb345d7f))
* Vega improvements ([#297](/github.com/sqlrooms/sqlrooms/issues/297)) ([7a1f5f7](github.com/sqlrooms/sqlrooms/commits/7a1f5f77763aa54e7f0b0e5b2dd0e24df7ebbebc))

# [0.27.0-rc.0](github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.13...v0.27.0-rc.0) (2025-12-27)

### Bug Fixes

* agent rendering and add abortSignal to query tool ([#267](/github.com/sqlrooms/sqlrooms/issues/267)) ([088bb4d](github.com/sqlrooms/sqlrooms/commits/088bb4dc1763bcaaa1ef62fb54fbb142974a4134))
* using escapeVal for value-comparison in addTable ([#268](/github.com/sqlrooms/sqlrooms/issues/268)) ([cd90e62](github.com/sqlrooms/sqlrooms/commits/cd90e62c8917c2467abbc0b895c7d68717470f3f))

### Features

* allow custom error component in AnalysisResult ([#269](/github.com/sqlrooms/sqlrooms/issues/269)) ([ab1d6c1](github.com/sqlrooms/sqlrooms/commits/ab1d6c1af0e74666c421c0b9a4a1eddb64f3adf1))
* Crdt package for realtime collaboration ([#266](/github.com/sqlrooms/sqlrooms/issues/266)) ([ab128ba](github.com/sqlrooms/sqlrooms/commits/ab128ba4452072f1a8593582c3060819e9916134))
* Introducing MosaicSlice ([#277](/github.com/sqlrooms/sqlrooms/issues/277)) ([55b37de](github.com/sqlrooms/sqlrooms/commits/55b37defa5894a57b96b0eaf3f238aa30e3bd05a))
* SQLRooms CLI ([#263](/github.com/sqlrooms/sqlrooms/issues/263)) ([d1937ff](github.com/sqlrooms/sqlrooms/commits/d1937ff6b42da12f0737051847d5b397fc97bfb5))
* Sync save debounce ([#273](/github.com/sqlrooms/sqlrooms/issues/273)) ([499dea1](github.com/sqlrooms/sqlrooms/commits/499dea1296ccf9705f3c4c892eb041acdd81eb9e))

## [0.26.1-rc.13](github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.12...v0.26.1-rc.13) (2025-12-12)

### Bug Fixes

* downgrade styled-components to 6.1.8 ([#264](/github.com/sqlrooms/sqlrooms/issues/264)) ([f8b1ce1](github.com/sqlrooms/sqlrooms/commits/f8b1ce1df617ea6a14b43c91c8b6eb3ea77d8025))
* Prevent infinite rerender in AI AnalysisResultsContainer ([#262](/github.com/sqlrooms/sqlrooms/issues/262)) ([1e46230](github.com/sqlrooms/sqlrooms/commits/1e46230bdab9b073b4e142b5c04850f802e10e8e))
* Security alerts: Upgrade deps with vulnerabilities ([#260](/github.com/sqlrooms/sqlrooms/issues/260)) ([7022349](github.com/sqlrooms/sqlrooms/commits/70223493c82713073f14ae893833a809a876dab7))

## [0.26.1-rc.12](github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.11...v0.26.1-rc.12) (2025-12-11)

### Bug Fixes

* **deps:** update dependency @paralleldrive/cuid2 to v3 ([#250](/github.com/sqlrooms/sqlrooms/issues/250)) ([ad0c539](github.com/sqlrooms/sqlrooms/commits/ad0c539a7664b2cee60184674c4c27c67c90514e))
* Update Kepler and fix duckdb imports ([#258](/github.com/sqlrooms/sqlrooms/issues/258)) ([adf8932](github.com/sqlrooms/sqlrooms/commits/adf8932961cdf0d9a47745e517f2bdc7902f5dd1))

## [0.26.1-rc.11](github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.10...v0.26.1-rc.11) (2025-12-10)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.10 (2025-12-10)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.9 (2025-12-10)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.8 (2025-12-10)

### Bug Fixes

* SqlEditorSliceConfig openTabs migration ([#256](/github.com/sqlrooms/sqlrooms/issues/256)) ([f213186](github.com/sqlrooms/sqlrooms/commits/f21318636d8151b942db6a15480731e86c00f5d4))

## 0.26.1-rc.7 (2025-12-05)

### Bug Fixes

* Incorrect import ([b194e35](github.com/sqlrooms/sqlrooms/commits/b194e35fbc7e99a900d81370d556b6fb1d4948aa))

## 0.26.1-rc.6 (2025-12-05)

### Bug Fixes

* Add missing dep @dnd-kit/modifiers ([78859e2](github.com/sqlrooms/sqlrooms/commits/78859e2b9ac0dad17209ac100d40e36f81da6c27))

## 0.26.1-rc.5 (2025-12-05)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.4 (2025-12-01)

### Bug Fixes

* Upgrade immer to prevent Object.freeze errors in kepler ([#218](/github.com/sqlrooms/sqlrooms/issues/218)) ([1fe2250](github.com/sqlrooms/sqlrooms/commits/1fe2250ca2acf578c26931632baa229f4b8ce881))

## [0.26.1-rc.3](github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.2...v0.26.1-rc.3) (2025-12-01)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.2 (2025-12-01)

### Bug Fixes

* Kepler fixes to prevent example app from crashing ([#217](/github.com/sqlrooms/sqlrooms/issues/217)) ([f57d9ff](github.com/sqlrooms/sqlrooms/commits/f57d9ff63a2356866ec99ba3fd9b203a8e35abb3))

## 0.26.1-rc.1 (2025-11-30)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.0 (2025-11-30)

**Note:** Version bump only for package sqlrooms

# 0.26.0 (2025-11-17)

**Note:** Version bump only for package sqlrooms

# 0.26.0-rc.6 (2025-11-12)

**Note:** Version bump only for package sqlrooms

# 0.26.0-rc.5 (2025-11-12)

### Features

* Separate config for every slice ([#156](/github.com/sqlrooms/sqlrooms/issues/156)) ([ae600c1](github.com/sqlrooms/sqlrooms/commits/ae600c124bec754bea9a71218dcb8203f11a5cce))

# 0.26.0-rc.4 (2025-11-10)

### Bug Fixes

* Styles of schema tree node and mosaic layout (main) ([#182](/github.com/sqlrooms/sqlrooms/issues/182)) ([0b4d55f](github.com/sqlrooms/sqlrooms/commits/0b4d55ff407b6a978acb47fecc3dd71203df3a69))

# 0.26.0-rc.3 (2025-10-23)

### Features

* migrate to ai sdk v5 ([#166](/github.com/sqlrooms/sqlrooms/issues/166)) ([f69529b](github.com/sqlrooms/sqlrooms/commits/f69529bb30cd9bfd85fb9b2c6a16a6769ae92061))

# 0.26.0-rc.2 (2025-10-08)

**Note:** Version bump only for package sqlrooms

# 0.26.0-rc.1 (2025-10-05)

**Note:** Version bump only for package sqlrooms

# 0.26.0-rc.0 (2025-10-03)

### Features

* Extract ai-core and ai-settings ([#155](https://github.com/sqlrooms/sqlrooms/issues/155)) ([5bf0238](https://github.com/sqlrooms/sqlrooms/commit/5bf02383f351ec7843f71bbbdbc41c6f141dadf2))

# 0.25.0-rc.0 (2025-10-02)

**Note:** Version bump only for package sqlrooms

## 0.24.28-rc.1 (2025-10-01)

**Note:** Version bump only for package sqlrooms

## [0.24.28-rc.0](https://github.com/sqlrooms/sqlrooms/compare/v0.24.27...v0.24.28-rc.0) (2025-10-01)

**Note:** Version bump only for package sqlrooms

## 0.24.27 (2025-09-26)

### Bug Fixes

* Schema tree styling allows for font size changes ([#149](https://github.com/sqlrooms/sqlrooms/issues/149)) ([9b88f5f](https://github.com/sqlrooms/sqlrooms/commit/9b88f5fbcee21cc51a87b7c3fc897eda86f87651))

## 0.24.26 (2025-09-25)

### Bug Fixes

* Schema tree styling allows for font size changes ([39319f8](https://github.com/sqlrooms/sqlrooms/commit/39319f83b77d62f054b103986d28994b9bb0912b))

## 0.24.25 (2025-09-23)

### Features

* add AI settings ui ([#132](https://github.com/sqlrooms/sqlrooms/issues/132)) ([34d27f8](https://github.com/sqlrooms/sqlrooms/commit/34d27f81a9167c1fe0f489e2aa8f698fdcd0b041))

## 0.24.24 (2025-09-23)

### Features

* Python websockets DuckDB server ([#143](https://github.com/sqlrooms/sqlrooms/issues/143)) ([4bf9e0e](https://github.com/sqlrooms/sqlrooms/commit/4bf9e0ed7ed4c68db06c6f91f11c3aa0d7d5fe5c))

## 0.24.23 (2025-09-17)

### Bug Fixes

* history messages not updated when switch chat sessions [#146](https://github.com/sqlrooms/sqlrooms/issues/146) ([1eba099](https://github.com/sqlrooms/sqlrooms/commit/1eba0990d3e0495e5fd3bf3ba76ab03060730219))

## 0.24.22 (2025-09-16)

### Features

* Ai charts and queries improvements ([#144](https://github.com/sqlrooms/sqlrooms/issues/144)) ([a006873](https://github.com/sqlrooms/sqlrooms/commit/a00687369e758ca2e70e11f59059c03fd258d0a9))

## 0.24.21 (2025-09-11)

### Features

* Ai assistant read only mode ([#137](https://github.com/sqlrooms/sqlrooms/issues/137)) ([c8c64d5](https://github.com/sqlrooms/sqlrooms/commit/c8c64d50b2c72e9e82ef530a653f71e4eef839cc))

## 0.24.20 (2025-09-11)

### Features

* Upgrade duckdb in examples to 1.30.0 ([#136](https://github.com/sqlrooms/sqlrooms/issues/136)) ([da4c99e](https://github.com/sqlrooms/sqlrooms/commit/da4c99eb88c57b0e835b8def508c0dcb511ab59a))

## 0.24.19 (2025-09-09)

### Bug Fixes

* Unify vite dependency versions in examples ([#135](https://github.com/sqlrooms/sqlrooms/issues/135)) ([a3772b8](https://github.com/sqlrooms/sqlrooms/commit/a3772b8527809e59988f1e09a7ebfc0664e6eacb))

## 0.24.18 (2025-09-05)

### Features

* Adding row click handlers to QueryResultPanel ([#130](https://github.com/sqlrooms/sqlrooms/issues/130)) ([6ee36d3](https://github.com/sqlrooms/sqlrooms/commit/6ee36d38a0e73a0482a573241aee4da67710dbff))

## 0.24.17 (2025-09-03)

### Features

* Canvas ([#122](https://github.com/sqlrooms/sqlrooms/issues/122)) ([56fcb8d](https://github.com/sqlrooms/sqlrooms/commit/56fcb8df399e81206be4beede30595157c75509b))

## 0.24.16 (2025-08-27)

### Features

* Add to DataTable: estimated rowCount, create table DDL and comment ([#127](https://github.com/sqlrooms/sqlrooms/issues/127)) ([13a6a7f](https://github.com/sqlrooms/sqlrooms/commit/13a6a7fb3f95ffd66c20bf6beec816bf225fdc91))

## 0.24.15 (2025-08-27)

**Note:** Version bump only for package sqlrooms

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

**Note:** Version bump only for package sqlrooms

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

**Note:** Version bump only for package sqlrooms

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

**Note:** Version bump only for package sqlrooms

# 0.10.0 (2025-04-08)

**Note:** Version bump only for package sqlrooms

## <small>0.9.3 (2025-04-03)</small>

- fix: Properly map all @sqlrooms/ui subpath exports (#38) ([2edd7d8](https://github.com/sqlrooms/sqlrooms/commit/2edd7d8)), closes [#38](https://github.com/sqlrooms/sqlrooms/issues/38)

## <small>0.9.1 (2025-04-01)</small>

- fix: Remove duplicate DuckDbSlice.tableExists ([ecc5a20](https://github.com/sqlrooms/sqlrooms/commit/ecc5a20))

# [0.9.0](https://github.com/sqlrooms/sqlrooms/compare/v0.8.1...v0.9.0) (2025-03-31)

### Features

- Duckdb slice with pluggable connector ([#31](https://github.com/sqlrooms/sqlrooms/issues/31)) ([515aae5](https://github.com/sqlrooms/sqlrooms/commit/515aae58ffdffe8bfa1889acd62a9acdcd68cb3d))

## [0.8.1](https://github.com/sqlrooms/sqlrooms/compare/v0.8.0...v0.8.1) (2025-03-10)

## Fixes

- Added missing `@tailwindcss/typography` dependency to `@sqlrooms/ui`

**Note:** Version bump only for package sqlrooms

# [0.8.0](https://github.com/sqlrooms/sqlrooms/compare/v0.7.0...v0.8.0) (2025-03-10)

### Features

- Support for Ai Sessions ([#25](https://github.com/sqlrooms/sqlrooms/issues/25)) ([328f7ff](https://github.com/sqlrooms/sqlrooms/commit/328f7ff0a1e77f2f4f1e6b08320097edc7c06c21)), closes [#27](https://github.com/sqlrooms/sqlrooms/issues/27)
- Config persistence improvements; AI example uses persistence
- AI UI improvements: rendering now closer resembles modern LLM interfaces
- AI supports multiple model providers now (anthropic, google, deepseek)
- Added UI components for AI: ModelSelector, SessionControls etc
- AI Better markdown rendering
- AI Custom tools support (added custom echo tool component to AI example)
- AI instructions (system prompt) are customizable now
- Vega chart is now a custom tool, moved to @sqlrooms/vega
- Using embedded JSON editor in AI results

# [0.7.0](https://github.com/sqlrooms/sqlrooms/compare/v0.6.0...v0.7.0) (2025-03-01)

### Features

- Adding SQL and JSON Monaco editors ([#24](https://github.com/sqlrooms/sqlrooms/issues/24)) ([656edd0](https://github.com/sqlrooms/sqlrooms/commit/656edd017cf477e10aa2fd1f5a6a90bcec879300))

# [0.6.0](https://github.com/sqlrooms/sqlrooms/compare/v0.5.1...v0.6.0) (2025-02-26)

### Features

- Renamed useDuckDbQuery -> useSql, adding .rows() iterator and .toArray() ([#18](https://github.com/sqlrooms/sqlrooms/issues/18)) ([26fd317](https://github.com/sqlrooms/sqlrooms/commit/26fd31767eeed38069c0c8cd0a3d3e1a7d85d6b4))
- switch to openassistant/core for AI module ([#11](https://github.com/sqlrooms/sqlrooms/issues/11)) ([5072e1f](https://github.com/sqlrooms/sqlrooms/commit/5072e1f286239396168f36a820159605b02b7f22))

## [0.5.1](https://github.com/sqlrooms/sqlrooms/compare/v0.5.0...v0.5.1) (2025-02-25)

**Note:** Version bump only for package sqlrooms

# [0.5.0](https://github.com/sqlrooms/sqlrooms/compare/v0.4.2...v0.5.0) (2025-02-24)

### Features

- Introducing cosmos slice ([#15](https://github.com/sqlrooms/sqlrooms/issues/15)) ([da51434](https://github.com/sqlrooms/sqlrooms/commit/da5143440ae7984fde1bc9e07e6e63e011c71091))

## [0.4.2](https://github.com/sqlrooms/sqlrooms/compare/v0.4.0...v0.4.2) (2025-02-23)

### Features

- Adding useDuckDbQuery ([68668bb](https://github.com/sqlrooms/sqlrooms/commit/68668bb1c96e102ee8f706e5067f8eb889423b56))

## [0.4.1](https://github.com/sqlrooms/sqlrooms/compare/v0.4.0...v0.4.1) (2025-02-21)

**Note:** Version bump only for package sqlrooms

# [0.4.0](https://github.com/sqlrooms/sqlrooms/compare/v0.3.0...v0.4.0) (2025-02-21)

**Note:** Version bump only for package sqlrooms

# [0.3.0](https://github.com/sqlrooms/sqlrooms/compare/v0.1.0...v0.3.0) (2025-02-13)

**Note:** Version bump only for package sqlrooms

# [0.2.0](https://github.com/sqlrooms/sqlrooms/compare/v0.1.0...v0.2.0) (2025-02-13)

**Note:** Version bump only for package sqlrooms

# [0.1.0](https://github.com/sqlrooms/sqlrooms/compare/v0.0.3...v0.1.0) (2025-02-10)

**Note:** Version bump only for package sqlrooms

## [0.0.3](https://github.com/sqlrooms/sqlrooms/compare/v0.0.2...v0.0.3) (2025-02-06)

**Note:** Version bump only for package sqlrooms

## [0.0.2](https://github.com/sqlrooms/sqlrooms/compare/v0.0.1...v0.0.2) (2025-02-03)

### Reverts

- Revert "chore(release): publish v0.0.2" ([6c00184](https://github.com/sqlrooms/sqlrooms/commit/6c00184595ac6be08424751e297880d1ed013364))

## [0.0.1](https://github.com/sqlrooms/sqlrooms/compare/v0.0.1-alpha.0...v0.0.1) (2025-01-30)

**Note:** Version bump only for package sqlrooms

## 0.0.1-alpha.0 (2025-01-30)

**Note:** Version bump only for package sqlrooms

**Note:** Version bump only for package sqlrooms
