# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.29.0-rc.2] (2026-04-20)

## BREAKING CHANGES

This release introduces explicit panel identity and dock boundaries, replacing the previous path-based panel resolution system.

### Removed APIs

* **`getPanelByPath`**: Path-based panel lookup function removed
* **`useGetPanelByPath`**: Hook for path-based panel lookup removed
* **`useGetPanelInfoByPath`**: Hook for path-based panel info removed
* **`draggable` property**: Removed from split and tabs nodes
* **`pathSegment` property**: Removed from split and tabs nodes

### API Changes

* **Panel definitions context**: Panel definitions now receive `{panelId, meta, layoutNode}` instead of `{panelId, params, layoutNode}`
  * Replace `ctx.params` with `ctx.meta` in all panel definition functions
* **Docking scope**: Docking operations now only work within `LayoutDockNode` boundaries
  * Panels cannot be moved across different dock nodes
  * Use `type: 'dock'` nodes to create docking boundaries

### New Features

* **`LayoutDockNode`**: New node type for creating docking boundaries
  * Structure: `{type: 'dock', id: string, panel?: PanelIdentity, root: LayoutNode}`
  * Replaces splits/tabs with `draggable: true`
* **Explicit panel identity**: Panels now have a direct `panel` property
  * String form: `panel: 'my-panel'`
  * Object form: `panel: {key: 'chart', meta: {chartId: '123'}}`
  * Falls back to node `id` if `panel` property is not provided
* **Direct panel resolution APIs**:
  * `resolvePanelIdentity(node)`: Extract `{panelId, meta}` from a node
  * `resolvePanelDefinition(definition, context)`: Resolve panel info with context
  * `useGetPanel(node)`: React hook for direct panel resolution
* **Type exports**: Added `isLayoutDockNode`, `LayoutDockNode`, `PanelIdentity` exports

### Migration Guide

See [contributing/architecture.md](contributing/architecture.md#migration-guide-explicit-panel-identity--dock-boundaries) for detailed migration instructions.

**Quick migration:**

1. Convert `draggable: true` splits to dock nodes:
   ```typescript
   // Before
   {type: 'split', id: 'dashboard', draggable: true, children: [...]}

   // After
   {type: 'dock', id: 'dashboard', root: {type: 'split', id: 'dashboard-root', children: [...]}}
   ```

2. Remove `pathSegment` properties from all nodes

3. Update panel definitions to use `meta` instead of `params`:
   ```typescript
   // Before
   panels: {chart: (ctx) => ({title: ctx.params?.chartId})}

   // After
   panels: {chart: (ctx) => ({title: ctx.meta?.chartId})}
   ```

4. Replace path-based hooks:
   ```typescript
   // Before
   import {useGetPanelByPath} from '@sqlrooms/layout';
   const panelInfo = useGetPanelByPath(path);

   // After
   import {useGetPanel, useLayoutNodeContext} from '@sqlrooms/layout';
   const context = useLayoutNodeContext();
   const panelInfo = useGetPanel(context.node);
   ```

### Affected Packages

* `@sqlrooms/layout-config`: Schema changes, new node types
* `@sqlrooms/layout`: API changes, new hooks
* `@sqlrooms/room-shell`: Updated to use new APIs
* All examples: Migrated to new layout structure
# [0.29.0-rc.2](github.com/sqlrooms/sqlrooms/compare/v0.29.0-rc.1...v0.29.0-rc.2) (2026-04-25)

### Bug Fixes

* add back draw geometry button ([#513](/github.com/sqlrooms/sqlrooms/issues/513)) ([0e74352](github.com/sqlrooms/sqlrooms/commits/0e74352016bd00bb007a40e0a018b44cca5bfdc6))
* add copy to ai assistant prompt ([#411](/github.com/sqlrooms/sqlrooms/issues/411)) ([2cc975a](github.com/sqlrooms/sqlrooms/commits/2cc975a462a44ad88c481c47e25c72094230e035))
* adjust padding in notebook examples ([#494](/github.com/sqlrooms/sqlrooms/issues/494)) ([1bf099a](github.com/sqlrooms/sqlrooms/commits/1bf099a61340e6422f7a12d0120a6a6bb19d8c2b))
* AiSettings: Prevent model name collisions ([#413](/github.com/sqlrooms/sqlrooms/issues/413)) ([4be44b9](github.com/sqlrooms/sqlrooms/commits/4be44b9dd40293e77a4db5ed5c4275afa423c94a))
* All schema tree menus are showing up at once ([#566](/github.com/sqlrooms/sqlrooms/issues/566)) ([e3c4a88](github.com/sqlrooms/sqlrooms/commits/e3c4a88a15483012fd537c5fb7ab0f61c9313f72))
* code mirror hover and autocomplete tooltips ([#499](/github.com/sqlrooms/sqlrooms/issues/499)) ([8d4b3fc](github.com/sqlrooms/sqlrooms/commits/8d4b3fc04004300a50e648849a7c3f07a16cd493))
* decrease height of suggestions ([#417](/github.com/sqlrooms/sqlrooms/issues/417)) ([bcd4f79](github.com/sqlrooms/sqlrooms/commits/bcd4f795bf9ab2e2d525a319d9959154667a5c81))
* Don't show empty footer in data table ([#412](/github.com/sqlrooms/sqlrooms/issues/412)) ([00fe136](github.com/sqlrooms/sqlrooms/commits/00fe136af0c1f56e0cece477095d318d145e4dbf))
* enable line numbers and highlight active line in SQL editor ([#463](/github.com/sqlrooms/sqlrooms/issues/463)) ([fa19e8c](github.com/sqlrooms/sqlrooms/commits/fa19e8c96f7d51d43e08e37c345c5614aa710d95))
* improve ai assistant text visibility ([#493](/github.com/sqlrooms/sqlrooms/issues/493)) ([805882c](github.com/sqlrooms/sqlrooms/commits/805882c895b675482dbf9292e3c52942e6527bcb))
* Improve copy message placement in AI assistant ([#392](/github.com/sqlrooms/sqlrooms/issues/392)) ([fce659c](github.com/sqlrooms/sqlrooms/commits/fce659c5fb16f2ddacafa37fc3ba1a16a80a0db7))
* monaco flicker pr test ([#344](/github.com/sqlrooms/sqlrooms/issues/344)) ([275084e](github.com/sqlrooms/sqlrooms/commits/275084e93e2e3846b00da3054dafbbc0b2034727))
* notebook pagination styling ([#479](/github.com/sqlrooms/sqlrooms/issues/479)) ([ed9b08a](github.com/sqlrooms/sqlrooms/commits/ed9b08ae65e7cd9ff4a89e5ca09523a1884d2ddd))
* only sync tables used by kepler ([#533](/github.com/sqlrooms/sqlrooms/issues/533)) ([b269675](github.com/sqlrooms/sqlrooms/commits/b26967502b4854127d84ac8b6f267cbf4c453b6e))
* subagent output render issue ([#505](/github.com/sqlrooms/sqlrooms/issues/505)) ([1bb4642](github.com/sqlrooms/sqlrooms/commits/1bb4642931013fdc442b29ba3326ad766eca2e6d))
* temporary disable SQL linter and gutter markers in DuckDB SQL extension ([#476](/github.com/sqlrooms/sqlrooms/issues/476)) ([4ba6095](github.com/sqlrooms/sqlrooms/commits/4ba609555f57e0ec81d9b98288c6a45445acd1a0))
* toModelOutput doesn't work in tool ([#510](/github.com/sqlrooms/sqlrooms/issues/510)) ([aca33f8](github.com/sqlrooms/sqlrooms/commits/aca33f84b2d61ec54f52e0b4e274c7906f38d940))
* update reason box highlight color ([#487](/github.com/sqlrooms/sqlrooms/issues/487)) ([a537fed](github.com/sqlrooms/sqlrooms/commits/a537fed52fe7003c29951e3d4c415ef7ec246bcd))
* WasmDuckDbConnector: worker not terminated on init failure ([#538](/github.com/sqlrooms/sqlrooms/issues/538)) ([a82ffe2](github.com/sqlrooms/sqlrooms/commits/a82ffe28dce7af832170cd6f888a84392da6b28e))
* word wrapping in notebook "Add new" cell dropdown ([#454](/github.com/sqlrooms/sqlrooms/issues/454)) ([888c0cd](github.com/sqlrooms/sqlrooms/commits/888c0cd1e09d9077d0a1a56496bdc422c1d39c37))

### Features

*  Deck.gl + geoarrow layers integration ([#549](/github.com/sqlrooms/sqlrooms/issues/549)) ([1dd3153](github.com/sqlrooms/sqlrooms/commits/1dd3153efb958b57227f8702967c3ed967a90375))
* add close button to the draw panel ([#515](/github.com/sqlrooms/sqlrooms/issues/515)) ([8e5a15a](github.com/sqlrooms/sqlrooms/commits/8e5a15a934e09a884797e99c82da4c1178d53d4e))
* add duplicate kepler map ([#410](/github.com/sqlrooms/sqlrooms/issues/410)) ([60a639e](github.com/sqlrooms/sqlrooms/commits/60a639e6ee6714964ab29a886a3d79ba5efd661a))
* add filter related kepler.gl actions in KeplerSlice ([#555](/github.com/sqlrooms/sqlrooms/issues/555)) ([ce023cc](github.com/sqlrooms/sqlrooms/commits/ce023cc64e6fb1adbcbdf0244574954b1f3dbc62))
* Add just-bash support for WebContainer editing ([#489](/github.com/sqlrooms/sqlrooms/issues/489)) ([7fbecb7](github.com/sqlrooms/sqlrooms/commits/7fbecb7948f312f0a9e27bdc1558858b0fac1496))
* add markdown MonacoEditor ([#544](/github.com/sqlrooms/sqlrooms/issues/544)) ([c18e25f](github.com/sqlrooms/sqlrooms/commits/c18e25f92f1cfac0d7926079b7cc3d15f9a8694b))
* add more map export resolution options ([#469](/github.com/sqlrooms/sqlrooms/issues/469)) ([352fc65](github.com/sqlrooms/sqlrooms/commits/352fc65771f0263768dc6beb4684c987d801aeb2))
* add updateTooltipFields to dispatch tooltip action in KeplerSlice ([#425](/github.com/sqlrooms/sqlrooms/issues/425)) ([8688abf](github.com/sqlrooms/sqlrooms/commits/8688abf144db97203e696fdb30746fc40b196db7))
* add Сopy button to SQL Cell results footer ([#458](/github.com/sqlrooms/sqlrooms/issues/458)) ([388299f](github.com/sqlrooms/sqlrooms/commits/388299f844e1da33eaa4a79bfdb262b1b2fccd00))
* CLI: Dynamic connector load ([#407](/github.com/sqlrooms/sqlrooms/issues/407)) ([e167396](github.com/sqlrooms/sqlrooms/commits/e167396c31a669219d6a329805358192bb359df5))
* CLI: Mosaic dashboard ([#408](/github.com/sqlrooms/sqlrooms/issues/408)) ([aeb614c](github.com/sqlrooms/sqlrooms/commits/aeb614ca70704a407ec34fe017c7f800a5bdaabf))
* CLI: Native DuckDB file loading ([#409](/github.com/sqlrooms/sqlrooms/issues/409)) ([bc32e25](github.com/sqlrooms/sqlrooms/commits/bc32e25b16d704598f51ecaeac539908373b3ba3))
* code mirror editors ([#418](/github.com/sqlrooms/sqlrooms/issues/418)) ([fb6bd0a](github.com/sqlrooms/sqlrooms/commits/fb6bd0ab0ace3604d7bc808dc912a16364d57a9c))
* control ToolCallDetailHover visibility in ai-core ([#556](/github.com/sqlrooms/sqlrooms/issues/556)) ([a45a7ec](github.com/sqlrooms/sqlrooms/commits/a45a7ec0443649a2a5cadb8fc977b36a2991172a))
* Db settings and connections editing ([#492](/github.com/sqlrooms/sqlrooms/issues/492)) ([aebcd22](github.com/sqlrooms/sqlrooms/commits/aebcd223fad05f4a74754b3107f23a3f96735f1d))
* hide connector dropdown when only one connector is available ([#456](/github.com/sqlrooms/sqlrooms/issues/456)) ([7349a11](github.com/sqlrooms/sqlrooms/commits/7349a11bf7961685a5c79da9d5e8994972a23857))
* implement internal resource filtering in createDbSchemaTrees ([#477](/github.com/sqlrooms/sqlrooms/issues/477)) ([a5f4220](github.com/sqlrooms/sqlrooms/commits/a5f422004ca6448dfe322e0bf3bb5bf152d5e801))
* Improved color scales + example app ([#565](/github.com/sqlrooms/sqlrooms/issues/565)) ([6fb92e7](github.com/sqlrooms/sqlrooms/commits/6fb92e7f6b288d52a72d0be3fc577dbb31e430a5))
* json schema completions ([#483](/github.com/sqlrooms/sqlrooms/issues/483)) ([f78a08b](github.com/sqlrooms/sqlrooms/commits/f78a08b286a5fad611053be62bcfdeba10962252))
* Mosaic chart builders ([#473](/github.com/sqlrooms/sqlrooms/issues/473)) ([9d4a874](github.com/sqlrooms/sqlrooms/commits/9d4a874094149dc557e4e007d7836612b347c9a9))
* Mosaic table profiler ([#527](/github.com/sqlrooms/sqlrooms/issues/527)) ([07005ae](github.com/sqlrooms/sqlrooms/commits/07005ae778d7a583a62fb187be6b716a854218f6))
* **mosaic:** accept optional custom Coordinator in createMosaicSlice ([#478](/github.com/sqlrooms/sqlrooms/issues/478)) ([f71cb6f](github.com/sqlrooms/sqlrooms/commits/f71cb6f7da68fcd343522deccb108c1ad49200e3))
* Pivot in notebooks (take 2)  ([#460](/github.com/sqlrooms/sqlrooms/issues/460)) ([01f24da](github.com/sqlrooms/sqlrooms/commits/01f24dadead2b4aa260d117aba808c287a25aaab))
* Pointer cursor on buttons ([#521](/github.com/sqlrooms/sqlrooms/issues/521)) ([eabafc5](github.com/sqlrooms/sqlrooms/commits/eabafc58fb546f2a2e1474088958790c4981c3c3))
* prevent SQL cell result name collisions ([#480](/github.com/sqlrooms/sqlrooms/issues/480)) ([f9fc960](github.com/sqlrooms/sqlrooms/commits/f9fc9607f0203c343645a0628a111e5f1aa7042f))
* refreshTableSchemas improvements ([#346](/github.com/sqlrooms/sqlrooms/issues/346)) ([daefc89](github.com/sqlrooms/sqlrooms/commits/daefc8971d9ff10e3d9a372df0fbd48b4688f7a3))
* replace AJV with vscode-json-languageservice ([#474](/github.com/sqlrooms/sqlrooms/issues/474)) ([0d16adb](github.com/sqlrooms/sqlrooms/commits/0d16adbf0cea3713d8be546003123fcf11d52a95))
* save chart cell automatically and other improvements  ([#502](/github.com/sqlrooms/sqlrooms/issues/502)) ([f11641a](github.com/sqlrooms/sqlrooms/commits/f11641a4bf8fd0f8b168db79cbf00fce03eba03a))
* Sonner toast integration ([#415](/github.com/sqlrooms/sqlrooms/issues/415)) ([b4a792e](github.com/sqlrooms/sqlrooms/commits/b4a792e269e37edbb1be930e011dd2cf47ffddbc))
* sql cell improvements ([#471](/github.com/sqlrooms/sqlrooms/issues/471)) ([5100260](github.com/sqlrooms/sqlrooms/commits/5100260893980904e3d2aa369964ed051cf04699))
* text/markdown cell improvements ([#455](/github.com/sqlrooms/sqlrooms/issues/455)) ([37b1327](github.com/sqlrooms/sqlrooms/commits/37b132749a892cf1d793bfb1ded3e664f05d0633))
* theme aware map styling ([#419](/github.com/sqlrooms/sqlrooms/issues/419)) ([e34f3b4](github.com/sqlrooms/sqlrooms/commits/e34f3b4589624c03ae5e14e9f768133c9131c5bd))
* Upgrade AI SDK to v6 ([#497](/github.com/sqlrooms/sqlrooms/issues/497)) ([bd17a5f](github.com/sqlrooms/sqlrooms/commits/bd17a5f860b78320ee820bf7c9fc074a7e8cf1ad))
* Vega crossfilter in notebook cells ([#488](/github.com/sqlrooms/sqlrooms/issues/488)) ([fdd3a40](github.com/sqlrooms/sqlrooms/commits/fdd3a4002e18e45f22d21cedb7030a59be5e07ae))

# [0.29.0-rc.1](github.com/sqlrooms/sqlrooms/compare/v0.29.0-rc.0...v0.29.0-rc.1) (2026-03-01)

**Note:** Version bump only for package sqlrooms

## [0.28.1-rc.1](github.com/sqlrooms/sqlrooms/compare/v0.28.1-rc.0...v0.28.1-rc.1) (2026-03-01)

### Bug Fixes

* sanitize UIMessages before sending to LLM to prevent empty content errors ([#404](/github.com/sqlrooms/sqlrooms/issues/404)) ([635fbbb](github.com/sqlrooms/sqlrooms/commits/635fbbb5c3cedd4bcd7ab4eed94199a8fe022528))

### Features

* Add shadcn Sidebar component ([#400](/github.com/sqlrooms/sqlrooms/issues/400)) ([b44ac17](github.com/sqlrooms/sqlrooms/commits/b44ac175770022867bd869e484ac10992606988f))
* Create sqlrooms notebook package ([#131](/github.com/sqlrooms/sqlrooms/issues/131)) ([f42caa2](github.com/sqlrooms/sqlrooms/commits/f42caa21f5e48f8e7b0dd522044c22858d81ba0f))
* Snowflake connector integration ([#401](/github.com/sqlrooms/sqlrooms/issues/401)) ([1ccbe61](github.com/sqlrooms/sqlrooms/commits/1ccbe61e7e5107edd1c2ec36f9604f8b6cfcf603))
* Webcontainer package ([#374](/github.com/sqlrooms/sqlrooms/issues/374)) ([c211b00](github.com/sqlrooms/sqlrooms/commits/c211b004b3aeff0984aa48521e7f247950c6cd0a))

## [0.28.1-rc.0](github.com/sqlrooms/sqlrooms/compare/v0.28.0...v0.28.1-rc.0) (2026-02-27)

### Bug Fixes

* Examples tailwind paths ([#387](/github.com/sqlrooms/sqlrooms/issues/387)) ([1cbae5b](github.com/sqlrooms/sqlrooms/commits/1cbae5b65191d082c9970a31e732724c660a82fa))
* move copy button ([#390](/github.com/sqlrooms/sqlrooms/issues/390)) ([a7ba4f2](github.com/sqlrooms/sqlrooms/commits/a7ba4f247c66240e86c98cc1173a0091bb81cd44))
* move copy button in the message container ([#388](/github.com/sqlrooms/sqlrooms/issues/388)) ([7c57d70](github.com/sqlrooms/sqlrooms/commits/7c57d7008af40efdefc87a98b00dd46bfdbc61fb))

### Features

* Commands system enhancements ([#396](/github.com/sqlrooms/sqlrooms/issues/396)) ([4585f80](github.com/sqlrooms/sqlrooms/commits/4585f80440eb070711005b857e73d58971754344))
* Sonner toast integration ([#397](/github.com/sqlrooms/sqlrooms/issues/397)) ([487861d](github.com/sqlrooms/sqlrooms/commits/487861df81f0824d077bdeb0bb517a054586279b))
* Tanstack multi-room example ([#385](/github.com/sqlrooms/sqlrooms/issues/385)) ([45ef14f](github.com/sqlrooms/sqlrooms/commits/45ef14ff9cb99528d7fefb372a98843006269e93))

# [0.28.0](github.com/sqlrooms/sqlrooms/compare/v0.28.0-rc.0...v0.28.0) (2026-02-25)

### Features

* Command system implementation ([#382](/github.com/sqlrooms/sqlrooms/issues/382)) ([1e53f05](github.com/sqlrooms/sqlrooms/commits/1e53f051828a36f8625af1c9576a820568951d42))
* Cosmos.gl upgrade ([#379](/github.com/sqlrooms/sqlrooms/issues/379)) ([92b3299](github.com/sqlrooms/sqlrooms/commits/92b3299f515aeb7b7bc1c5d5967827cb5a11ee55))

# [0.28.0-rc.0](github.com/sqlrooms/sqlrooms/compare/v0.27.0...v0.28.0-rc.0) (2026-02-21)

### Bug Fixes

* update custom map legend panel when exporting image ([#372](/github.com/sqlrooms/sqlrooms/issues/372)) ([144741e](github.com/sqlrooms/sqlrooms/commits/144741e8e5d1cfef942756809010d162a58e8c8f))

### Features

* tailwind v4 ([#324](/github.com/sqlrooms/sqlrooms/issues/324)) ([1d03e12](github.com/sqlrooms/sqlrooms/commits/1d03e125e0e4eb162cca83ce32d71ec85b74ef54))

# [0.27.0](github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.5...v0.27.0) (2026-02-20)

### Bug Fixes

* fix vega chart sizing ([#365](/github.com/sqlrooms/sqlrooms/issues/365)) ([c9ed288](github.com/sqlrooms/sqlrooms/commits/c9ed28845aeae3739070ef3615e843076090f7f7))
* improve sql error display in vega charts ([#369](/github.com/sqlrooms/sqlrooms/issues/369)) ([0d26265](github.com/sqlrooms/sqlrooms/commits/0d2626512d98d9c4b983d0e8c640a64c20cb08e8))

### Features

* AI output copy to clipboard ([#368](/github.com/sqlrooms/sqlrooms/issues/368)) ([bcc10c1](github.com/sqlrooms/sqlrooms/commits/bcc10c12cac3219f762406fb18e4a4ee04546ada))
* Data table row selection ([#358](/github.com/sqlrooms/sqlrooms/issues/358)) ([3c63689](github.com/sqlrooms/sqlrooms/commits/3c636899dae81d13b24d501e9752257bced89e30))

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
