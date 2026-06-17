# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.29.0-rc.7](https://github.com/sqlrooms/sqlrooms/compare/v0.29.0-rc.6...v0.29.0-rc.7) (2026-06-05)

### Bug Fixes

* Accept artifact config input shape in artifacts slice ([#693](https://github.com/sqlrooms/sqlrooms/issues/693)) ([5cda1db](https://github.com/sqlrooms/sqlrooms/commit/5cda1db15f949411c0de1fd989a8b4dc783b3c9a))
* Deckgl example load error (downgrading duckdb-wasm) ([#667](https://github.com/sqlrooms/sqlrooms/issues/667)) ([ff2ae6a](https://github.com/sqlrooms/sqlrooms/commit/ff2ae6a11f7740abc9508166f4a26c2efc411a1b))
* Incomplete and malformed tool-call part in conversation ([#679](https://github.com/sqlrooms/sqlrooms/issues/679)) ([0290981](https://github.com/sqlrooms/sqlrooms/commit/0290981bfa45e4949b30ed0bfaaebb37d5501949))
* not show tool call cancelled by user ([#688](https://github.com/sqlrooms/sqlrooms/issues/688)) ([2379043](https://github.com/sqlrooms/sqlrooms/commit/237904389513ff7dd5397e2058cfc50093256e7f))
* Query result timestamp formatting for Arrow values ([#680](https://github.com/sqlrooms/sqlrooms/issues/680)) ([adebb03](https://github.com/sqlrooms/sqlrooms/commit/adebb035f37fcad3cf72c929554113efc09aae8a))

### Features

* Add a storage-agnostic persistence controller to SQLRooms ([#682](https://github.com/sqlrooms/sqlrooms/issues/682)) ([ddd5a86](https://github.com/sqlrooms/sqlrooms/commit/ddd5a86deb0eaccdd75cbe43b162b13eefbfcf37))
* Add data table explorer blocks to Mosaic dashboards ([#668](https://github.com/sqlrooms/sqlrooms/issues/668)) ([72c628a](https://github.com/sqlrooms/sqlrooms/commit/72c628acf51028796b04bb0d5eabb8ec41b085d5))
* Add reusable SQL query blocks and artifact tabs ([#669](https://github.com/sqlrooms/sqlrooms/issues/669)) ([42eb60c](https://github.com/sqlrooms/sqlrooms/commit/42eb60c5c90e3ffb2d18b6feb256f403137cd124))
* Add tables to AI agent context ([#664](https://github.com/sqlrooms/sqlrooms/issues/664)) ([b556abe](https://github.com/sqlrooms/sqlrooms/commit/b556abed19d9a976e39bfd1895e5a03b2d10ff15))
* Ai model persistence migration ([#361](https://github.com/sqlrooms/sqlrooms/issues/361)) ([01fab51](https://github.com/sqlrooms/sqlrooms/commit/01fab51b7f5c3bbc00ab95c0d21522bd8e44863f))
* Blocks and BlockDocument ([#666](https://github.com/sqlrooms/sqlrooms/issues/666)) ([aa9d9e1](https://github.com/sqlrooms/sqlrooms/commit/aa9d9e1a037fde0a6914993fd192366cc7b51e86))
* charts refactoring ([#673](https://github.com/sqlrooms/sqlrooms/issues/673)) ([ed3c814](https://github.com/sqlrooms/sqlrooms/commit/ed3c8142e01e69b3b4374776cbd4742ed40a17b6))
* Improve SQL editor completions for DuckDB functions and columns ([#665](https://github.com/sqlrooms/sqlrooms/issues/665)) ([87549ca](https://github.com/sqlrooms/sqlrooms/commit/87549ca85cff8f75ff80ea2abe5613c5b6b80ece))
* Persist AI settings to TOML in the CLI ([#653](https://github.com/sqlrooms/sqlrooms/issues/653)) ([1589d5d](https://github.com/sqlrooms/sqlrooms/commit/1589d5de7b1581f32339c046f59a91a90010e3a0))
* render agent reasoning text instead of agent title ([#687](https://github.com/sqlrooms/sqlrooms/issues/687)) ([86186b8](https://github.com/sqlrooms/sqlrooms/commit/86186b8ebab4a63872582177732fa20cba631dc3))

# [0.29.0-rc.6](https://github.com/sqlrooms/sqlrooms/compare/v0.29.0-rc.5...v0.29.0-rc.6) (2026-05-26)

### Bug Fixes

* add fix to scroll to bottom ([#658](https://github.com/sqlrooms/sqlrooms/issues/658)) ([b4c73bb](https://github.com/sqlrooms/sqlrooms/commit/b4c73bb552ab1cfdfc9e47672b4c14667674491e))
* Ai styling fixes ([#644](https://github.com/sqlrooms/sqlrooms/issues/644)) ([14b698a](https://github.com/sqlrooms/sqlrooms/commit/14b698add6e9e7f56e83b8d8df683b2ce7a2c361))
* Layout: Prevent panel resize from being stuck ([#660](https://github.com/sqlrooms/sqlrooms/issues/660)) ([ce18931](https://github.com/sqlrooms/sqlrooms/commit/ce189319c7fb095b78c05bec7e3d383b703c453f))
* properly pass props to kepler internal redux state ([#655](https://github.com/sqlrooms/sqlrooms/issues/655)) ([4a5f630](https://github.com/sqlrooms/sqlrooms/commit/4a5f63076f16c3b888942db40bcd4ecd60f56b10))
* Remove tooltip provider from sidebar ([#642](https://github.com/sqlrooms/sqlrooms/issues/642)) ([5374c20](https://github.com/sqlrooms/sqlrooms/commit/5374c206c1059e5980b690b831fbde4e0f0a9147))
* Update dependencies to address vulnerabilities ([#663](https://github.com/sqlrooms/sqlrooms/issues/663)) ([0b2cbb9](https://github.com/sqlrooms/sqlrooms/commit/0b2cbb971aa2a4177891e0a8690348159ad03b0f))

### Features

* Add chart-owned runtime data limits and issue reporting ([#656](https://github.com/sqlrooms/sqlrooms/issues/656)) ([6c65b20](https://github.com/sqlrooms/sqlrooms/commit/6c65b206ad2687561333cc764e0e302ceeee45ea))
* add expand button to categorical legend ([#647](https://github.com/sqlrooms/sqlrooms/issues/647)) ([94ca393](https://github.com/sqlrooms/sqlrooms/commit/94ca3931a64f0a7d2da881f08b0e16463442b9b4))
* add maxBins configuration to histogram  ([#637](https://github.com/sqlrooms/sqlrooms/issues/637)) ([dbde573](https://github.com/sqlrooms/sqlrooms/commit/dbde5733763dbab518e30b993ed3a83089a15070))
* add overlaid integration mode to DeckJsonMap ([#661](https://github.com/sqlrooms/sqlrooms/issues/661)) ([3478884](https://github.com/sqlrooms/sqlrooms/commit/3478884de5f32fd0bb0f82aaa8e45541fdf0641f))
* Add primary artifact run context tools ([#646](https://github.com/sqlrooms/sqlrooms/issues/646)) ([8537413](https://github.com/sqlrooms/sqlrooms/commit/8537413fba9ac430b35fbeb6ba0cfc01f124b805))
* Add transcript text search to AI chat ([#628](https://github.com/sqlrooms/sqlrooms/issues/628)) ([75dfde2](https://github.com/sqlrooms/sqlrooms/commit/75dfde2881681e743a2b8c3516c4a3426cfce708))
* Adding forceMount option to TabsLayout ([#645](https://github.com/sqlrooms/sqlrooms/issues/645)) ([f0978ef](https://github.com/sqlrooms/sqlrooms/commit/f0978ef6573c5bac5d8863a173dabad3324712ae))
* Agent sessions UI improvements ([#649](https://github.com/sqlrooms/sqlrooms/issues/649)) ([8b7e71e](https://github.com/sqlrooms/sqlrooms/commit/8b7e71eabbd053ad368d665f1962bf0192633fe0))
* ai powered dashboards ([#634](https://github.com/sqlrooms/sqlrooms/issues/634)) ([54b7962](https://github.com/sqlrooms/sqlrooms/commit/54b796214f3a7f4003a31bbae3de1745532ae395))
* Deck map ai tool ([#654](https://github.com/sqlrooms/sqlrooms/issues/654)) ([3f47820](https://github.com/sqlrooms/sqlrooms/commit/3f478202a23c9cde01c6eaaf3fee2aa54644ed11))
* enhanced dasboard creation ([#651](https://github.com/sqlrooms/sqlrooms/issues/651)) ([f3f0b9e](https://github.com/sqlrooms/sqlrooms/commit/f3f0b9e2318e31e1c5380ccde84b439be32cf2c6))
* expand deck example with Overture buildings ([#570](https://github.com/sqlrooms/sqlrooms/issues/570)) ([da3cebe](https://github.com/sqlrooms/sqlrooms/commit/da3cebe4a3206c0c3037ff956dd468139ea9b434))
* Harden Python server and CLI launcher against SQL injection and remote exposure ([#557](https://github.com/sqlrooms/sqlrooms/issues/557)) ([6f16ee5](https://github.com/sqlrooms/sqlrooms/commit/6f16ee5b35eb50f180f4fe8d48e6a82c8aea7a59))
* implement data point limit validation and error handling in charts ([#638](https://github.com/sqlrooms/sqlrooms/issues/638)) ([dfa39de](https://github.com/sqlrooms/sqlrooms/commit/dfa39ded1867c6f6bd92814b4e183b38dc2d46fc))
* show all schemas in the datasource panel ([#639](https://github.com/sqlrooms/sqlrooms/issues/639)) ([cb9a590](https://github.com/sqlrooms/sqlrooms/commit/cb9a590b63897a9e10e2d226174673ea6eca8a1c))
* Stabilize targeted dev startup order ([#648](https://github.com/sqlrooms/sqlrooms/issues/648)) ([8824c05](https://github.com/sqlrooms/sqlrooms/commit/8824c059014e0d3affc7bc9605d7d97044b08eb5))
* text panel improvements ([#657](https://github.com/sqlrooms/sqlrooms/issues/657)) ([6a286dc](https://github.com/sqlrooms/sqlrooms/commit/6a286dcbd133aaec8e99707c4621b818a6050110))
* Upgrade DuckDB to 1.5.3 ([#659](https://github.com/sqlrooms/sqlrooms/issues/659)) ([cc15a10](https://github.com/sqlrooms/sqlrooms/commit/cc15a10a44687163c3c8d6d00423cc3e57dd3036))

# [0.29.0-rc.5](https://github.com/sqlrooms/sqlrooms/compare/v0.29.0-rc.4...v0.29.0-rc.5) (2026-05-18)

### Bug Fixes

* ai-core tool auto-resume ([#630](https://github.com/sqlrooms/sqlrooms/issues/630)) ([b323060](https://github.com/sqlrooms/sqlrooms/commit/b32306098d882ce6ee6db2d27a5ab1595aa467da))
* cli don't serve core server ui ([#633](https://github.com/sqlrooms/sqlrooms/issues/633)) ([9c78504](https://github.com/sqlrooms/sqlrooms/commit/9c785040682c6387e53716b193ca983c8a280772))
* Collapse reasoning messages in chat ([#632](https://github.com/sqlrooms/sqlrooms/issues/632)) ([c932f1e](https://github.com/sqlrooms/sqlrooms/commit/c932f1e6a4c87934c4ac51723a6c0df11af2a534))
* Persist split panel resize state ([#631](https://github.com/sqlrooms/sqlrooms/issues/631)) ([f20f4f6](https://github.com/sqlrooms/sqlrooms/commit/f20f4f630ce7b0509c09f2d443070413b4daaaa7))

### Features

* skills subsystem + authoring wizard in @sqlrooms/ai ([#574](https://github.com/sqlrooms/sqlrooms/issues/574)) ([c3d2a9e](https://github.com/sqlrooms/sqlrooms/commit/c3d2a9ef5b44bc6e5536927d64bd1981b2b2aaa8))

# [0.29.0-rc.4](https://github.com/sqlrooms/sqlrooms/compare/v0.29.0-rc.3...v0.29.0-rc.4) (2026-05-17)

### Bug Fixes

* Artifact creation issues ([#616](https://github.com/sqlrooms/sqlrooms/issues/616)) ([2824e5c](https://github.com/sqlrooms/sqlrooms/commit/2824e5cf865b0e26a256b1f0c808965abb86350a))
* count plot chart display horizontally and only allow categorical fields ([#620](https://github.com/sqlrooms/sqlrooms/issues/620)) ([a352e09](https://github.com/sqlrooms/sqlrooms/commit/a352e09fd88162faee8817162ffd449f0288ca22))
* Fix build and potential Mosaic duckdb-wasm type mismatch ([#625](https://github.com/sqlrooms/sqlrooms/issues/625)) ([1332308](https://github.com/sqlrooms/sqlrooms/commit/13323082b7679bf2e06f7af46076d53affe7a851))
* Pass AI run context into dashboard chart tool resolution ([#627](https://github.com/sqlrooms/sqlrooms/issues/627)) ([229b4d1](https://github.com/sqlrooms/sqlrooms/commit/229b4d1e55019720f37faa95c51db445f3eb42a1))
* Prevent-concurrent-publish ([#629](https://github.com/sqlrooms/sqlrooms/issues/629)) ([f277f57](https://github.com/sqlrooms/sqlrooms/commit/f277f57c090223395313e9249519a12d2fc0e9a8))
* Remove AI_DEFAULT_TEMPERATURE ([#610](https://github.com/sqlrooms/sqlrooms/issues/610)) ([c03d46a](https://github.com/sqlrooms/sqlrooms/commit/c03d46ab995b635bbd2ccc4e05ae709a70239387))
* Rename freeze in tab-strip ([#614](https://github.com/sqlrooms/sqlrooms/issues/614)) ([02c4bd9](https://github.com/sqlrooms/sqlrooms/commit/02c4bd93e6f900c6011bf3d6badf5c1433ad321e))
* use CustomErrorBoundary in RoomShell ([#514](https://github.com/sqlrooms/sqlrooms/issues/514)) ([6ea9896](https://github.com/sqlrooms/sqlrooms/commit/6ea98964ff9a1c4fc8bc1af2345527ca52cb90f4))

### Features

* Add chat prompt context ([#598](https://github.com/sqlrooms/sqlrooms/issues/598)) ([ce29e0e](https://github.com/sqlrooms/sqlrooms/commit/ce29e0e7c916dca5af0b9f7bea91777b920a42b6))
* add Text panel support to Mosaic Dashboard ([#622](https://github.com/sqlrooms/sqlrooms/issues/622)) ([e1584eb](https://github.com/sqlrooms/sqlrooms/commit/e1584ebc7691c9746490096d2298a67f6b0f57ef))
* aggregations, multiple lines in line chart and dashboard tools refactoring ([#591](https://github.com/sqlrooms/sqlrooms/issues/591)) ([278d244](https://github.com/sqlrooms/sqlrooms/commit/278d24460154960fe9b9d806758e45f5aafe5e1f))
* Box plot for mosaic dashboards ([#588](https://github.com/sqlrooms/sqlrooms/issues/588)) ([2fc7d18](https://github.com/sqlrooms/sqlrooms/commit/2fc7d1861afc8e3fd24c7e97e6874d4ec9740763))
* dashboard empty state ([#619](https://github.com/sqlrooms/sqlrooms/issues/619)) ([e09fe80](https://github.com/sqlrooms/sqlrooms/commit/e09fe80900286694cb7aebd03bd4152f8e52911e))
* decompose AssistantPanel component ([#623](https://github.com/sqlrooms/sqlrooms/issues/623)) ([15f694b](https://github.com/sqlrooms/sqlrooms/commit/15f694bc6bae52862cd84211395a104f1a3ce6bc))
* Document artifact ([#603](https://github.com/sqlrooms/sqlrooms/issues/603)) ([14c96f9](https://github.com/sqlrooms/sqlrooms/commit/14c96f9ed72f56a20ecbf08441c472221f3bd4ad))
* Embed charts as image assets in documents ([#612](https://github.com/sqlrooms/sqlrooms/issues/612)) ([4705d19](https://github.com/sqlrooms/sqlrooms/commit/4705d19f046949fb58d0581117bef2dc52aa3190))
* enhance tool descriptions for clarity ([#621](https://github.com/sqlrooms/sqlrooms/issues/621)) ([a48a9a5](https://github.com/sqlrooms/sqlrooms/commit/a48a9a5328106b59a6266f5a57f4d03097f299bd))
* remove eCDF chart ([#608](https://github.com/sqlrooms/sqlrooms/issues/608)) ([733d8d5](https://github.com/sqlrooms/sqlrooms/commit/733d8d52108cf237d59f21d0ea750b39bcc29781))

### Reverts

* Remove Vega cross-filtering from notebook cells ([#611](https://github.com/sqlrooms/sqlrooms/issues/611)) ([8c3d047](https://github.com/sqlrooms/sqlrooms/commit/8c3d047e122724ef3229dc51ea60c87175e55c63))

# [0.29.0-rc.3](https://github.com/sqlrooms/sqlrooms/compare/v0.29.0-rc.2...v0.29.0-rc.3) (2026-05-07)

### Bug Fixes

* deckgl mosaic example fixes ([#586](https://github.com/sqlrooms/sqlrooms/issues/586)) ([024461b](https://github.com/sqlrooms/sqlrooms/commits/024461bc550b33f1d87e234e8895ad2a2fbbe0d1))
* DeckJsonMap: nudge render on load ([#587](https://github.com/sqlrooms/sqlrooms/issues/587)) ([761bcaf](https://github.com/sqlrooms/sqlrooms/commits/761bcaf182a5a079b6d23d2ce1573e6134155351))
* kepler legend should overlay on top of bottom widget ([#578](https://github.com/sqlrooms/sqlrooms/issues/578)) ([1e85041](https://github.com/sqlrooms/sqlrooms/commits/1e850413a252222db6b48fad4cb25910b13bbdba))

### Features

* add split map functionality and related context to Kepler ([#563](https://github.com/sqlrooms/sqlrooms/issues/563)) ([9328d21](https://github.com/sqlrooms/sqlrooms/commits/9328d21feb552983881e267ee8298fdbc160e19e))
* customizable tool render behavior in ai-core ([#561](https://github.com/sqlrooms/sqlrooms/issues/561)) ([b8cadf5](https://github.com/sqlrooms/sqlrooms/commits/b8cadf571dbc7bd65440a7f868e5a9843f3ef90d))
* dashboard charts settings ([#581](https://github.com/sqlrooms/sqlrooms/issues/581)) ([afc1f0e](https://github.com/sqlrooms/sqlrooms/commits/afc1f0e89f8febea4c05526ccfc085a544d0caca))
* dnd-kit docking layout ([#552](https://github.com/sqlrooms/sqlrooms/issues/552)) ([b6876c0](https://github.com/sqlrooms/sqlrooms/commits/b6876c008459f417754bba99394154bce7c48455))
* enhance CustomMapLegend with close functionality and fix split pane support in CustomMapLegendPanel ([#584](https://github.com/sqlrooms/sqlrooms/issues/584)) ([0a96750](https://github.com/sqlrooms/sqlrooms/commits/0a967502270a1e32fb28629e1e43a429d8ee4e0e))
* Grid layout: more resize options ([#594](https://github.com/sqlrooms/sqlrooms/issues/594)) ([46dcf3d](https://github.com/sqlrooms/sqlrooms/commits/46dcf3d9e6054e9f1da1ac659470628a65b8bf7b))
* Kepler: Removing currentMapId to align with artifacts ([#595](https://github.com/sqlrooms/sqlrooms/issues/595)) ([efe9eb7](https://github.com/sqlrooms/sqlrooms/commits/efe9eb714522f1f29bc408604a120a830c401e63))
* **layout:** Add grid node type for scrollable dashboard layouts ([#575](https://github.com/sqlrooms/sqlrooms/issues/575)) ([0166d1e](https://github.com/sqlrooms/sqlrooms/commits/0166d1e098de1b3794f9ba29e85a75cbcbfd63ee))
* Mosaic dashboards ([#539](https://github.com/sqlrooms/sqlrooms/issues/539)) ([ae2c193](https://github.com/sqlrooms/sqlrooms/commits/ae2c19365565a50971ed672b4331752e96161f0e))
* Mosaic preagg in an ephemeral database ([#585](https://github.com/sqlrooms/sqlrooms/issues/585)) ([0262bac](https://github.com/sqlrooms/sqlrooms/commits/0262bac6afb58d557635443857bdd16c84b93609))
* update ai chat ui component ([#576](https://github.com/sqlrooms/sqlrooms/issues/576)) ([0770869](https://github.com/sqlrooms/sqlrooms/commits/0770869066e440bb765d7e7872d883176ee96ff7))

# [0.29.0-rc.2](https://github.com/sqlrooms/sqlrooms/compare/v0.29.0-rc.1...v0.29.0-rc.2) (2026-04-25)

### Bug Fixes

* add back draw geometry button ([#513](https://github.com/sqlrooms/sqlrooms/issues/513)) ([0e74352](https://github.com/sqlrooms/sqlrooms/commits/0e74352016bd00bb007a40e0a018b44cca5bfdc6))
* add copy to ai assistant prompt ([#411](https://github.com/sqlrooms/sqlrooms/issues/411)) ([2cc975a](https://github.com/sqlrooms/sqlrooms/commits/2cc975a462a44ad88c481c47e25c72094230e035))
* adjust padding in notebook examples ([#494](https://github.com/sqlrooms/sqlrooms/issues/494)) ([1bf099a](https://github.com/sqlrooms/sqlrooms/commits/1bf099a61340e6422f7a12d0120a6a6bb19d8c2b))
* AiSettings: Prevent model name collisions ([#413](https://github.com/sqlrooms/sqlrooms/issues/413)) ([4be44b9](https://github.com/sqlrooms/sqlrooms/commits/4be44b9dd40293e77a4db5ed5c4275afa423c94a))
* All schema tree menus are showing up at once ([#566](https://github.com/sqlrooms/sqlrooms/issues/566)) ([e3c4a88](https://github.com/sqlrooms/sqlrooms/commits/e3c4a88a15483012fd537c5fb7ab0f61c9313f72))
* code mirror hover and autocomplete tooltips ([#499](https://github.com/sqlrooms/sqlrooms/issues/499)) ([8d4b3fc](https://github.com/sqlrooms/sqlrooms/commits/8d4b3fc04004300a50e648849a7c3f07a16cd493))
* decrease height of suggestions ([#417](https://github.com/sqlrooms/sqlrooms/issues/417)) ([bcd4f79](https://github.com/sqlrooms/sqlrooms/commits/bcd4f795bf9ab2e2d525a319d9959154667a5c81))
* Don't show empty footer in data table ([#412](https://github.com/sqlrooms/sqlrooms/issues/412)) ([00fe136](https://github.com/sqlrooms/sqlrooms/commits/00fe136af0c1f56e0cece477095d318d145e4dbf))
* enable line numbers and highlight active line in SQL editor ([#463](https://github.com/sqlrooms/sqlrooms/issues/463)) ([fa19e8c](https://github.com/sqlrooms/sqlrooms/commits/fa19e8c96f7d51d43e08e37c345c5614aa710d95))
* improve ai assistant text visibility ([#493](https://github.com/sqlrooms/sqlrooms/issues/493)) ([805882c](https://github.com/sqlrooms/sqlrooms/commits/805882c895b675482dbf9292e3c52942e6527bcb))
* Improve copy message placement in AI assistant ([#392](https://github.com/sqlrooms/sqlrooms/issues/392)) ([fce659c](https://github.com/sqlrooms/sqlrooms/commits/fce659c5fb16f2ddacafa37fc3ba1a16a80a0db7))
* monaco flicker pr test ([#344](https://github.com/sqlrooms/sqlrooms/issues/344)) ([275084e](https://github.com/sqlrooms/sqlrooms/commits/275084e93e2e3846b00da3054dafbbc0b2034727))
* notebook pagination styling ([#479](https://github.com/sqlrooms/sqlrooms/issues/479)) ([ed9b08a](https://github.com/sqlrooms/sqlrooms/commits/ed9b08ae65e7cd9ff4a89e5ca09523a1884d2ddd))
* only sync tables used by kepler ([#533](https://github.com/sqlrooms/sqlrooms/issues/533)) ([b269675](https://github.com/sqlrooms/sqlrooms/commits/b26967502b4854127d84ac8b6f267cbf4c453b6e))
* subagent output render issue ([#505](https://github.com/sqlrooms/sqlrooms/issues/505)) ([1bb4642](https://github.com/sqlrooms/sqlrooms/commits/1bb4642931013fdc442b29ba3326ad766eca2e6d))
* temporary disable SQL linter and gutter markers in DuckDB SQL extension ([#476](https://github.com/sqlrooms/sqlrooms/issues/476)) ([4ba6095](https://github.com/sqlrooms/sqlrooms/commits/4ba609555f57e0ec81d9b98288c6a45445acd1a0))
* toModelOutput doesn't work in tool ([#510](https://github.com/sqlrooms/sqlrooms/issues/510)) ([aca33f8](https://github.com/sqlrooms/sqlrooms/commits/aca33f84b2d61ec54f52e0b4e274c7906f38d940))
* update reason box highlight color ([#487](https://github.com/sqlrooms/sqlrooms/issues/487)) ([a537fed](https://github.com/sqlrooms/sqlrooms/commits/a537fed52fe7003c29951e3d4c415ef7ec246bcd))
* WasmDuckDbConnector: worker not terminated on init failure ([#538](https://github.com/sqlrooms/sqlrooms/issues/538)) ([a82ffe2](https://github.com/sqlrooms/sqlrooms/commits/a82ffe28dce7af832170cd6f888a84392da6b28e))
* word wrapping in notebook "Add new" cell dropdown ([#454](https://github.com/sqlrooms/sqlrooms/issues/454)) ([888c0cd](https://github.com/sqlrooms/sqlrooms/commits/888c0cd1e09d9077d0a1a56496bdc422c1d39c37))

### Features

*  Deck.gl + geoarrow layers integration ([#549](https://github.com/sqlrooms/sqlrooms/issues/549)) ([1dd3153](https://github.com/sqlrooms/sqlrooms/commits/1dd3153efb958b57227f8702967c3ed967a90375))
* add close button to the draw panel ([#515](https://github.com/sqlrooms/sqlrooms/issues/515)) ([8e5a15a](https://github.com/sqlrooms/sqlrooms/commits/8e5a15a934e09a884797e99c82da4c1178d53d4e))
* add duplicate kepler map ([#410](https://github.com/sqlrooms/sqlrooms/issues/410)) ([60a639e](https://github.com/sqlrooms/sqlrooms/commits/60a639e6ee6714964ab29a886a3d79ba5efd661a))
* add filter related kepler.gl actions in KeplerSlice ([#555](https://github.com/sqlrooms/sqlrooms/issues/555)) ([ce023cc](https://github.com/sqlrooms/sqlrooms/commits/ce023cc64e6fb1adbcbdf0244574954b1f3dbc62))
* Add just-bash support for WebContainer editing ([#489](https://github.com/sqlrooms/sqlrooms/issues/489)) ([7fbecb7](https://github.com/sqlrooms/sqlrooms/commits/7fbecb7948f312f0a9e27bdc1558858b0fac1496))
* add markdown MonacoEditor ([#544](https://github.com/sqlrooms/sqlrooms/issues/544)) ([c18e25f](https://github.com/sqlrooms/sqlrooms/commits/c18e25f92f1cfac0d7926079b7cc3d15f9a8694b))
* add more map export resolution options ([#469](https://github.com/sqlrooms/sqlrooms/issues/469)) ([352fc65](https://github.com/sqlrooms/sqlrooms/commits/352fc65771f0263768dc6beb4684c987d801aeb2))
* add updateTooltipFields to dispatch tooltip action in KeplerSlice ([#425](https://github.com/sqlrooms/sqlrooms/issues/425)) ([8688abf](https://github.com/sqlrooms/sqlrooms/commits/8688abf144db97203e696fdb30746fc40b196db7))
* add Сopy button to SQL Cell results footer ([#458](https://github.com/sqlrooms/sqlrooms/issues/458)) ([388299f](https://github.com/sqlrooms/sqlrooms/commits/388299f844e1da33eaa4a79bfdb262b1b2fccd00))
* CLI: Dynamic connector load ([#407](https://github.com/sqlrooms/sqlrooms/issues/407)) ([e167396](https://github.com/sqlrooms/sqlrooms/commits/e167396c31a669219d6a329805358192bb359df5))
* CLI: Mosaic dashboard ([#408](https://github.com/sqlrooms/sqlrooms/issues/408)) ([aeb614c](https://github.com/sqlrooms/sqlrooms/commits/aeb614ca70704a407ec34fe017c7f800a5bdaabf))
* CLI: Native DuckDB file loading ([#409](https://github.com/sqlrooms/sqlrooms/issues/409)) ([bc32e25](https://github.com/sqlrooms/sqlrooms/commits/bc32e25b16d704598f51ecaeac539908373b3ba3))
* code mirror editors ([#418](https://github.com/sqlrooms/sqlrooms/issues/418)) ([fb6bd0a](https://github.com/sqlrooms/sqlrooms/commits/fb6bd0ab0ace3604d7bc808dc912a16364d57a9c))
* control ToolCallDetailHover visibility in ai-core ([#556](https://github.com/sqlrooms/sqlrooms/issues/556)) ([a45a7ec](https://github.com/sqlrooms/sqlrooms/commits/a45a7ec0443649a2a5cadb8fc977b36a2991172a))
* Db settings and connections editing ([#492](https://github.com/sqlrooms/sqlrooms/issues/492)) ([aebcd22](https://github.com/sqlrooms/sqlrooms/commits/aebcd223fad05f4a74754b3107f23a3f96735f1d))
* hide connector dropdown when only one connector is available ([#456](https://github.com/sqlrooms/sqlrooms/issues/456)) ([7349a11](https://github.com/sqlrooms/sqlrooms/commits/7349a11bf7961685a5c79da9d5e8994972a23857))
* implement internal resource filtering in createDbSchemaTrees ([#477](https://github.com/sqlrooms/sqlrooms/issues/477)) ([a5f4220](https://github.com/sqlrooms/sqlrooms/commits/a5f422004ca6448dfe322e0bf3bb5bf152d5e801))
* Improved color scales + example app ([#565](https://github.com/sqlrooms/sqlrooms/issues/565)) ([6fb92e7](https://github.com/sqlrooms/sqlrooms/commits/6fb92e7f6b288d52a72d0be3fc577dbb31e430a5))
* json schema completions ([#483](https://github.com/sqlrooms/sqlrooms/issues/483)) ([f78a08b](https://github.com/sqlrooms/sqlrooms/commits/f78a08b286a5fad611053be62bcfdeba10962252))
* Mosaic chart builders ([#473](https://github.com/sqlrooms/sqlrooms/issues/473)) ([9d4a874](https://github.com/sqlrooms/sqlrooms/commits/9d4a874094149dc557e4e007d7836612b347c9a9))
* Mosaic table profiler ([#527](https://github.com/sqlrooms/sqlrooms/issues/527)) ([07005ae](https://github.com/sqlrooms/sqlrooms/commits/07005ae778d7a583a62fb187be6b716a854218f6))
* **mosaic:** accept optional custom Coordinator in createMosaicSlice ([#478](https://github.com/sqlrooms/sqlrooms/issues/478)) ([f71cb6f](https://github.com/sqlrooms/sqlrooms/commits/f71cb6f7da68fcd343522deccb108c1ad49200e3))
* Pivot in notebooks (take 2)  ([#460](https://github.com/sqlrooms/sqlrooms/issues/460)) ([01f24da](https://github.com/sqlrooms/sqlrooms/commits/01f24dadead2b4aa260d117aba808c287a25aaab))
* Pointer cursor on buttons ([#521](https://github.com/sqlrooms/sqlrooms/issues/521)) ([eabafc5](https://github.com/sqlrooms/sqlrooms/commits/eabafc58fb546f2a2e1474088958790c4981c3c3))
* prevent SQL cell result name collisions ([#480](https://github.com/sqlrooms/sqlrooms/issues/480)) ([f9fc960](https://github.com/sqlrooms/sqlrooms/commits/f9fc9607f0203c343645a0628a111e5f1aa7042f))
* refreshTableSchemas improvements ([#346](https://github.com/sqlrooms/sqlrooms/issues/346)) ([daefc89](https://github.com/sqlrooms/sqlrooms/commits/daefc8971d9ff10e3d9a372df0fbd48b4688f7a3))
* replace AJV with vscode-json-languageservice ([#474](https://github.com/sqlrooms/sqlrooms/issues/474)) ([0d16adb](https://github.com/sqlrooms/sqlrooms/commits/0d16adbf0cea3713d8be546003123fcf11d52a95))
* save chart cell automatically and other improvements  ([#502](https://github.com/sqlrooms/sqlrooms/issues/502)) ([f11641a](https://github.com/sqlrooms/sqlrooms/commits/f11641a4bf8fd0f8b168db79cbf00fce03eba03a))
* Sonner toast integration ([#415](https://github.com/sqlrooms/sqlrooms/issues/415)) ([b4a792e](https://github.com/sqlrooms/sqlrooms/commits/b4a792e269e37edbb1be930e011dd2cf47ffddbc))
* sql cell improvements ([#471](https://github.com/sqlrooms/sqlrooms/issues/471)) ([5100260](https://github.com/sqlrooms/sqlrooms/commits/5100260893980904e3d2aa369964ed051cf04699))
* text/markdown cell improvements ([#455](https://github.com/sqlrooms/sqlrooms/issues/455)) ([37b1327](https://github.com/sqlrooms/sqlrooms/commits/37b132749a892cf1d793bfb1ded3e664f05d0633))
* theme aware map styling ([#419](https://github.com/sqlrooms/sqlrooms/issues/419)) ([e34f3b4](https://github.com/sqlrooms/sqlrooms/commits/e34f3b4589624c03ae5e14e9f768133c9131c5bd))
* Upgrade AI SDK to v6 ([#497](https://github.com/sqlrooms/sqlrooms/issues/497)) ([bd17a5f](https://github.com/sqlrooms/sqlrooms/commits/bd17a5f860b78320ee820bf7c9fc074a7e8cf1ad))
* Vega crossfilter in notebook cells ([#488](https://github.com/sqlrooms/sqlrooms/issues/488)) ([fdd3a40](https://github.com/sqlrooms/sqlrooms/commits/fdd3a4002e18e45f22d21cedb7030a59be5e07ae))

# [0.29.0-rc.1](https://github.com/sqlrooms/sqlrooms/compare/v0.29.0-rc.0...v0.29.0-rc.1) (2026-03-01)

**Note:** Version bump only for package sqlrooms

## [0.28.1-rc.1](https://github.com/sqlrooms/sqlrooms/compare/v0.28.1-rc.0...v0.28.1-rc.1) (2026-03-01)

### Bug Fixes

* sanitize UIMessages before sending to LLM to prevent empty content errors ([#404](https://github.com/sqlrooms/sqlrooms/issues/404)) ([635fbbb](https://github.com/sqlrooms/sqlrooms/commits/635fbbb5c3cedd4bcd7ab4eed94199a8fe022528))

### Features

* Add shadcn Sidebar component ([#400](https://github.com/sqlrooms/sqlrooms/issues/400)) ([b44ac17](https://github.com/sqlrooms/sqlrooms/commits/b44ac175770022867bd869e484ac10992606988f))
* Create sqlrooms notebook package ([#131](https://github.com/sqlrooms/sqlrooms/issues/131)) ([f42caa2](https://github.com/sqlrooms/sqlrooms/commits/f42caa21f5e48f8e7b0dd522044c22858d81ba0f))
* Snowflake connector integration ([#401](https://github.com/sqlrooms/sqlrooms/issues/401)) ([1ccbe61](https://github.com/sqlrooms/sqlrooms/commits/1ccbe61e7e5107edd1c2ec36f9604f8b6cfcf603))
* Webcontainer package ([#374](https://github.com/sqlrooms/sqlrooms/issues/374)) ([c211b00](https://github.com/sqlrooms/sqlrooms/commits/c211b004b3aeff0984aa48521e7f247950c6cd0a))

## [0.28.1-rc.0](https://github.com/sqlrooms/sqlrooms/compare/v0.28.0...v0.28.1-rc.0) (2026-02-27)

### Bug Fixes

* Examples tailwind paths ([#387](https://github.com/sqlrooms/sqlrooms/issues/387)) ([1cbae5b](https://github.com/sqlrooms/sqlrooms/commits/1cbae5b65191d082c9970a31e732724c660a82fa))
* move copy button ([#390](https://github.com/sqlrooms/sqlrooms/issues/390)) ([a7ba4f2](https://github.com/sqlrooms/sqlrooms/commits/a7ba4f247c66240e86c98cc1173a0091bb81cd44))
* move copy button in the message container ([#388](https://github.com/sqlrooms/sqlrooms/issues/388)) ([7c57d70](https://github.com/sqlrooms/sqlrooms/commits/7c57d7008af40efdefc87a98b00dd46bfdbc61fb))

### Features

* Commands system enhancements ([#396](https://github.com/sqlrooms/sqlrooms/issues/396)) ([4585f80](https://github.com/sqlrooms/sqlrooms/commits/4585f80440eb070711005b857e73d58971754344))
* Sonner toast integration ([#397](https://github.com/sqlrooms/sqlrooms/issues/397)) ([487861d](https://github.com/sqlrooms/sqlrooms/commits/487861df81f0824d077bdeb0bb517a054586279b))
* Tanstack multi-room example ([#385](https://github.com/sqlrooms/sqlrooms/issues/385)) ([45ef14f](https://github.com/sqlrooms/sqlrooms/commits/45ef14ff9cb99528d7fefb372a98843006269e93))

# [0.28.0](https://github.com/sqlrooms/sqlrooms/compare/v0.28.0-rc.0...v0.28.0) (2026-02-25)

### Features

* Command system implementation ([#382](https://github.com/sqlrooms/sqlrooms/issues/382)) ([1e53f05](https://github.com/sqlrooms/sqlrooms/commits/1e53f051828a36f8625af1c9576a820568951d42))
* Cosmos.gl upgrade ([#379](https://github.com/sqlrooms/sqlrooms/issues/379)) ([92b3299](https://github.com/sqlrooms/sqlrooms/commits/92b3299f515aeb7b7bc1c5d5967827cb5a11ee55))

# [0.28.0-rc.0](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0...v0.28.0-rc.0) (2026-02-21)

### Bug Fixes

* update custom map legend panel when exporting image ([#372](https://github.com/sqlrooms/sqlrooms/issues/372)) ([144741e](https://github.com/sqlrooms/sqlrooms/commits/144741e8e5d1cfef942756809010d162a58e8c8f))

### Features

* tailwind v4 ([#324](https://github.com/sqlrooms/sqlrooms/issues/324)) ([1d03e12](https://github.com/sqlrooms/sqlrooms/commits/1d03e125e0e4eb162cca83ce32d71ec85b74ef54))

# [0.27.0](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.5...v0.27.0) (2026-02-20)

### Bug Fixes

* fix vega chart sizing ([#365](https://github.com/sqlrooms/sqlrooms/issues/365)) ([c9ed288](https://github.com/sqlrooms/sqlrooms/commits/c9ed28845aeae3739070ef3615e843076090f7f7))
* improve sql error display in vega charts ([#369](https://github.com/sqlrooms/sqlrooms/issues/369)) ([0d26265](https://github.com/sqlrooms/sqlrooms/commits/0d2626512d98d9c4b983d0e8c640a64c20cb08e8))

### Features

* AI output copy to clipboard ([#368](https://github.com/sqlrooms/sqlrooms/issues/368)) ([bcc10c1](https://github.com/sqlrooms/sqlrooms/commits/bcc10c12cac3219f762406fb18e4a4ee04546ada))
* Data table row selection ([#358](https://github.com/sqlrooms/sqlrooms/issues/358)) ([3c63689](https://github.com/sqlrooms/sqlrooms/commits/3c636899dae81d13b24d501e9752257bced89e30))

# [0.27.0-rc.5](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.4...v0.27.0-rc.5) (2026-02-14)

### Features

* room-store: expose bound useRoomStore API and add useRoomStoreApi hook ([#360](https://github.com/sqlrooms/sqlrooms/issues/360)) ([c5b68a3](https://github.com/sqlrooms/sqlrooms/commits/c5b68a329c7134c1937927b53a7c39b0ac4f06ea))

# [0.27.0-rc.4](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.3...v0.27.0-rc.4) (2026-02-11)

### Bug Fixes

* AI settings changes are only applied in new sessions ([#356](https://github.com/sqlrooms/sqlrooms/issues/356)) ([d1799d0](https://github.com/sqlrooms/sqlrooms/commits/d1799d0ab503be3a872a8cda948fe50bac0bc60c))
* Avoid deckgl v8 type errors ([#351](https://github.com/sqlrooms/sqlrooms/issues/351)) ([b3d5b88](https://github.com/sqlrooms/sqlrooms/commits/b3d5b887b27e12f83f0340294758cf23cc7f23bc))
* ColumnTypeBadge styling ([#350](https://github.com/sqlrooms/sqlrooms/issues/350)) ([25dcd19](https://github.com/sqlrooms/sqlrooms/commits/25dcd194806c5ace4f5b30b2f562070131a79639))
* getKeplerFactory causing constant remounting ([#352](https://github.com/sqlrooms/sqlrooms/issues/352)) ([bd2fbf0](https://github.com/sqlrooms/sqlrooms/commits/bd2fbf07485ae1ab1b545b36c82ee6f0c2467a5b))
* getKeplerFactory number of hook calls errors ([#354](https://github.com/sqlrooms/sqlrooms/issues/354)) ([c52fa70](https://github.com/sqlrooms/sqlrooms/commits/c52fa70f15667959b72e63a065ac513f5084403b))
* Kepler injector improvements ([#349](https://github.com/sqlrooms/sqlrooms/issues/349)) ([4a7295b](https://github.com/sqlrooms/sqlrooms/commits/4a7295b5120b2278422c04ce878520dfa8cfaaa4))

### Features

* AI: Ask for API key inline in chat input ([#357](https://github.com/sqlrooms/sqlrooms/issues/357)) ([f256021](https://github.com/sqlrooms/sqlrooms/commits/f256021abb0b7f981d392f5e6d8c61e71e5eed09))
* make View Instructions optional ([#353](https://github.com/sqlrooms/sqlrooms/issues/353)) ([7782c36](https://github.com/sqlrooms/sqlrooms/commits/7782c363951a72fdf1c158cd85f50cb4f36f6d9f))

# [0.27.0-rc.3](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.2...v0.27.0-rc.3) (2026-02-05)

### Bug Fixes

* Ai suggestions div height ([24c2909](https://github.com/sqlrooms/sqlrooms/commits/24c290995519cecd17f6dab45f2229d059b720a5))
* chart label position and add responsive font size ([#328](https://github.com/sqlrooms/sqlrooms/issues/328)) ([99c5099](https://github.com/sqlrooms/sqlrooms/commits/99c509950f48f0d3e8128f9704939e247fbc8f90))
* color utils get css color from theme mode ([#331](https://github.com/sqlrooms/sqlrooms/issues/331)) ([caa4db9](https://github.com/sqlrooms/sqlrooms/commits/caa4db9def2c9c790905500940a03bbd95b60e1f))
* configureKeplerInjector factory resolving was happening early ([#326](https://github.com/sqlrooms/sqlrooms/issues/326)) ([19b3b14](https://github.com/sqlrooms/sqlrooms/commits/19b3b1470462aa93e315bbc3619bf8a52a0e744f))
* eslint configuration ([#317](https://github.com/sqlrooms/sqlrooms/issues/317)) ([24b8619](https://github.com/sqlrooms/sqlrooms/commits/24b8619f33b784bbe5b853b465cbde350209b8e0))
* fix tab reordering ([#340](https://github.com/sqlrooms/sqlrooms/issues/340)) ([338b880](https://github.com/sqlrooms/sqlrooms/commits/338b880d5808d5df7e5b4fbac5fd41f73626dd51))
* monaco editor flashing ([#306](https://github.com/sqlrooms/sqlrooms/issues/306)) ([35e4420](https://github.com/sqlrooms/sqlrooms/commits/35e4420f21360460ed4950043e0628ef82f5ff93)), closes [#313](https://github.com/sqlrooms/sqlrooms/issues/313)
* Prevent horizontal scrolling in TabStrip.SearchDropdown ([#341](https://github.com/sqlrooms/sqlrooms/issues/341)) ([c574017](https://github.com/sqlrooms/sqlrooms/commits/c574017083591c36fbda4b00147fc7a5d2a4c73a))
* Prevent type errors in React 18 which don't have `inert` ([#323](https://github.com/sqlrooms/sqlrooms/issues/323)) ([505498b](https://github.com/sqlrooms/sqlrooms/commits/505498b3b021bd72f4b278b95b3d986c0e73f708))
* rollback query panel ([#339](https://github.com/sqlrooms/sqlrooms/issues/339)) ([f9efcd5](https://github.com/sqlrooms/sqlrooms/commits/f9efcd5cd319eb41cd3c75ea48da355b8304376b))
* TabStrip scroll into view ([#312](https://github.com/sqlrooms/sqlrooms/issues/312)) ([271efcf](https://github.com/sqlrooms/sqlrooms/commits/271efcfea8c095703d4e05150d75b59144d62930))
* Vector tiles creating layers ([#325](https://github.com/sqlrooms/sqlrooms/issues/325)) ([132ee22](https://github.com/sqlrooms/sqlrooms/commits/132ee229c4349679c3b681c9ce9e50d8d8aed851))

### Features

* Abort query in CreateTableForm ([#321](https://github.com/sqlrooms/sqlrooms/issues/321)) ([ff16aad](https://github.com/sqlrooms/sqlrooms/commits/ff16aada806e60dc0f23e69d64668046d98ec087))
* AI open session tabs now saved in AI slice config ([#315](https://github.com/sqlrooms/sqlrooms/issues/315)) ([34a33cb](https://github.com/sqlrooms/sqlrooms/commits/34a33cb1819275e3365aaf7c4607405ec6a2d663))
* Charts actions: only show on hover ([#336](https://github.com/sqlrooms/sqlrooms/issues/336)) ([87a21ce](https://github.com/sqlrooms/sqlrooms/commits/87a21ce58bc15b09b790456bd8d1719416c3ae44))
* Configurable Kepler injector with custom recipe support ([#318](https://github.com/sqlrooms/sqlrooms/issues/318)) ([2337ff4](https://github.com/sqlrooms/sqlrooms/commits/2337ff4c189dd6d2c9827edae4717e89fe7a30ea))
* enhance ErrorMessage component with customizable Markdown components ([#333](https://github.com/sqlrooms/sqlrooms/issues/333)) ([ffe618a](https://github.com/sqlrooms/sqlrooms/commits/ffe618a9de8655de4bf18fcdf6df1c8f53cd8622))
* improve explain query output in sqleditor ([#308](https://github.com/sqlrooms/sqlrooms/issues/308)) ([1557c4b](https://github.com/sqlrooms/sqlrooms/commits/1557c4be52c7198b55f28132cba1f10a31fa148b))
* Introduce ScrollableRow ([#337](https://github.com/sqlrooms/sqlrooms/issues/337)) ([d1d90cc](https://github.com/sqlrooms/sqlrooms/commits/d1d90cc9a0b99ef7854b3501f882d4759117f6fe))
* Prompt suggestion improvements ([#316](https://github.com/sqlrooms/sqlrooms/issues/316)) ([55eba6c](https://github.com/sqlrooms/sqlrooms/commits/55eba6cf7fcf449c9c88d9e058478c63959f7ec1))
* render reasoning in agent tool ([#322](https://github.com/sqlrooms/sqlrooms/issues/322)) ([ffca82e](https://github.com/sqlrooms/sqlrooms/commits/ffca82eef19eb6d617a48ce3ee376e64987f747e))

# [0.27.0-rc.2](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.1...v0.27.0-rc.2) (2026-01-22)

### Bug Fixes

* query result panels are mapped based on query tab id ([#304](https://github.com/sqlrooms/sqlrooms/issues/304)) ([a3c6a83](https://github.com/sqlrooms/sqlrooms/commits/a3c6a83d2b567890496d4409a834e527afb1f89c))
* show chart as inline component in the sidebar ([#303](https://github.com/sqlrooms/sqlrooms/issues/303)) ([a201c46](https://github.com/sqlrooms/sqlrooms/commits/a201c46e7504ef0fd0390f58ae5728dad8847b88))

### Features

* Add storeKey to createRoomStore ([#307](https://github.com/sqlrooms/sqlrooms/issues/307)) ([c829bdb](https://github.com/sqlrooms/sqlrooms/commits/c829bdbabd71cdceac4afd818cbff405377e3cd0))
* Prepare sqlrooms-server for publishing ([#305](https://github.com/sqlrooms/sqlrooms/issues/305)) ([d120996](https://github.com/sqlrooms/sqlrooms/commits/d120996cb3c5a02c36df048b5e79947c55140aa1))

# [0.27.0-rc.1](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.0...v0.27.0-rc.1) (2026-01-17)

### Bug Fixes

* AI Fix tool error message layout ([#287](https://github.com/sqlrooms/sqlrooms/issues/287)) ([660a7df](https://github.com/sqlrooms/sqlrooms/commits/660a7df8dfcd8a39e007ad8eb7e4e8d6e2bbeaff))
* Date and decimal types display incorrectly in data table ([#289](https://github.com/sqlrooms/sqlrooms/issues/289)) ([41a5750](https://github.com/sqlrooms/sqlrooms/commits/41a575076874eccb04e2e4f787136bbe43ae7b6d))
* **deps:** update dependency react-vega to v8 ([#255](https://github.com/sqlrooms/sqlrooms/issues/255)) ([fa352f4](https://github.com/sqlrooms/sqlrooms/commits/fa352f43b1ed32afce7ca9a8575ecd1205001d45))
* Dev-only: HMR store preservation utilities ([#294](https://github.com/sqlrooms/sqlrooms/issues/294)) ([d0e73ad](https://github.com/sqlrooms/sqlrooms/commits/d0e73addf068b1216d6cb430d7deedbb6a0b6cbe))
* dynamic font class resolver ([#291](https://github.com/sqlrooms/sqlrooms/issues/291)) ([7b11d21](https://github.com/sqlrooms/sqlrooms/commits/7b11d212e2ac930920c0779abe48899ebbd2a78b))
* query data table popover content format ([#288](https://github.com/sqlrooms/sqlrooms/issues/288)) ([b1cd872](https://github.com/sqlrooms/sqlrooms/commits/b1cd872bb8839aa4631765824e4385762f589c57))
* schema tree row count alignment ([#295](https://github.com/sqlrooms/sqlrooms/issues/295)) ([02f4395](https://github.com/sqlrooms/sqlrooms/commits/02f439557af647f024dfef0672d55000baaba255))
* timeline slider not showing for trip layer ([#276](https://github.com/sqlrooms/sqlrooms/issues/276)) ([5c28903](https://github.com/sqlrooms/sqlrooms/commits/5c289033711d5d39a621f729ddd8788ae1740728))

### Features

* add custom value rendered for arrow table ([#292](https://github.com/sqlrooms/sqlrooms/issues/292)) ([9e86149](https://github.com/sqlrooms/sqlrooms/commits/9e86149106cb8371739d5acaa88b943c7a3d06c9))
* add provider options to AiSlice ([#275](https://github.com/sqlrooms/sqlrooms/issues/275)) ([f23a72b](https://github.com/sqlrooms/sqlrooms/commits/f23a72beef0008a410813861da50a2347355d144))
* AI: Support parallel sessions ([#284](https://github.com/sqlrooms/sqlrooms/issues/284)) ([d5c6402](https://github.com/sqlrooms/sqlrooms/commits/d5c6402981341da9dec73d2b6da738a7d430f598))
* Kepler legend fixes ([#285](https://github.com/sqlrooms/sqlrooms/issues/285)) ([809aaa8](https://github.com/sqlrooms/sqlrooms/commits/809aaa8b2b23dbda4802e1b22076abd94cd979b6))
* propagate the change to the arrow table to parent components ([#299](https://github.com/sqlrooms/sqlrooms/issues/299)) ([0d6a335](https://github.com/sqlrooms/sqlrooms/commits/0d6a335fd770a90fa454d7f5d3a5f21aedb0e5d1))
* Remove delete chat message button ([#298](https://github.com/sqlrooms/sqlrooms/issues/298)) ([b955820](https://github.com/sqlrooms/sqlrooms/commits/b9558201b6190e4802943eecc142e40550f8face))
* Vega actions toolbar ([#301](https://github.com/sqlrooms/sqlrooms/issues/301)) ([ef68f2e](https://github.com/sqlrooms/sqlrooms/commits/ef68f2ef0b6c36855dbe247261cd7e4beb345d7f))
* Vega improvements ([#297](https://github.com/sqlrooms/sqlrooms/issues/297)) ([7a1f5f7](https://github.com/sqlrooms/sqlrooms/commits/7a1f5f77763aa54e7f0b0e5b2dd0e24df7ebbebc))

# [0.27.0-rc.0](https://github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.13...v0.27.0-rc.0) (2025-12-27)

### Bug Fixes

* agent rendering and add abortSignal to query tool ([#267](https://github.com/sqlrooms/sqlrooms/issues/267)) ([088bb4d](https://github.com/sqlrooms/sqlrooms/commits/088bb4dc1763bcaaa1ef62fb54fbb142974a4134))
* using escapeVal for value-comparison in addTable ([#268](https://github.com/sqlrooms/sqlrooms/issues/268)) ([cd90e62](https://github.com/sqlrooms/sqlrooms/commits/cd90e62c8917c2467abbc0b895c7d68717470f3f))

### Features

* allow custom error component in AnalysisResult ([#269](https://github.com/sqlrooms/sqlrooms/issues/269)) ([ab1d6c1](https://github.com/sqlrooms/sqlrooms/commits/ab1d6c1af0e74666c421c0b9a4a1eddb64f3adf1))
* Crdt package for realtime collaboration ([#266](https://github.com/sqlrooms/sqlrooms/issues/266)) ([ab128ba](https://github.com/sqlrooms/sqlrooms/commits/ab128ba4452072f1a8593582c3060819e9916134))
* Introducing MosaicSlice ([#277](https://github.com/sqlrooms/sqlrooms/issues/277)) ([55b37de](https://github.com/sqlrooms/sqlrooms/commits/55b37defa5894a57b96b0eaf3f238aa30e3bd05a))
* SQLRooms CLI ([#263](https://github.com/sqlrooms/sqlrooms/issues/263)) ([d1937ff](https://github.com/sqlrooms/sqlrooms/commits/d1937ff6b42da12f0737051847d5b397fc97bfb5))
* Sync save debounce ([#273](https://github.com/sqlrooms/sqlrooms/issues/273)) ([499dea1](https://github.com/sqlrooms/sqlrooms/commits/499dea1296ccf9705f3c4c892eb041acdd81eb9e))

## [0.26.1-rc.13](https://github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.12...v0.26.1-rc.13) (2025-12-12)

### Bug Fixes

* downgrade styled-components to 6.1.8 ([#264](https://github.com/sqlrooms/sqlrooms/issues/264)) ([f8b1ce1](https://github.com/sqlrooms/sqlrooms/commits/f8b1ce1df617ea6a14b43c91c8b6eb3ea77d8025))
* Prevent infinite rerender in AI AnalysisResultsContainer ([#262](https://github.com/sqlrooms/sqlrooms/issues/262)) ([1e46230](https://github.com/sqlrooms/sqlrooms/commits/1e46230bdab9b073b4e142b5c04850f802e10e8e))
* Security alerts: Upgrade deps with vulnerabilities ([#260](https://github.com/sqlrooms/sqlrooms/issues/260)) ([7022349](https://github.com/sqlrooms/sqlrooms/commits/70223493c82713073f14ae893833a809a876dab7))

## [0.26.1-rc.12](https://github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.11...v0.26.1-rc.12) (2025-12-11)

### Bug Fixes

* **deps:** update dependency @paralleldrive/cuid2 to v3 ([#250](https://github.com/sqlrooms/sqlrooms/issues/250)) ([ad0c539](https://github.com/sqlrooms/sqlrooms/commits/ad0c539a7664b2cee60184674c4c27c67c90514e))
* Update Kepler and fix duckdb imports ([#258](https://github.com/sqlrooms/sqlrooms/issues/258)) ([adf8932](https://github.com/sqlrooms/sqlrooms/commits/adf8932961cdf0d9a47745e517f2bdc7902f5dd1))

## [0.26.1-rc.11](https://github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.10...v0.26.1-rc.11) (2025-12-10)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.10 (2025-12-10)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.9 (2025-12-10)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.8 (2025-12-10)

### Bug Fixes

* SqlEditorSliceConfig openTabs migration ([#256](https://github.com/sqlrooms/sqlrooms/issues/256)) ([f213186](https://github.com/sqlrooms/sqlrooms/commits/f21318636d8151b942db6a15480731e86c00f5d4))

## 0.26.1-rc.7 (2025-12-05)

### Bug Fixes

* Incorrect import ([b194e35](https://github.com/sqlrooms/sqlrooms/commits/b194e35fbc7e99a900d81370d556b6fb1d4948aa))

## 0.26.1-rc.6 (2025-12-05)

### Bug Fixes

* Add missing dep @dnd-kit/modifiers ([78859e2](https://github.com/sqlrooms/sqlrooms/commits/78859e2b9ac0dad17209ac100d40e36f81da6c27))

## 0.26.1-rc.5 (2025-12-05)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.4 (2025-12-01)

### Bug Fixes

* Upgrade immer to prevent Object.freeze errors in kepler ([#218](https://github.com/sqlrooms/sqlrooms/issues/218)) ([1fe2250](https://github.com/sqlrooms/sqlrooms/commits/1fe2250ca2acf578c26931632baa229f4b8ce881))

## [0.26.1-rc.3](https://github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.2...v0.26.1-rc.3) (2025-12-01)

**Note:** Version bump only for package sqlrooms

## 0.26.1-rc.2 (2025-12-01)

### Bug Fixes

* Kepler fixes to prevent example app from crashing ([#217](https://github.com/sqlrooms/sqlrooms/issues/217)) ([f57d9ff](https://github.com/sqlrooms/sqlrooms/commits/f57d9ff63a2356866ec99ba3fd9b203a8e35abb3))

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

* Separate config for every slice ([#156](https://github.com/sqlrooms/sqlrooms/issues/156)) ([ae600c1](https://github.com/sqlrooms/sqlrooms/commits/ae600c124bec754bea9a71218dcb8203f11a5cce))

# 0.26.0-rc.4 (2025-11-10)

### Bug Fixes

* Styles of schema tree node and mosaic layout (main) ([#182](https://github.com/sqlrooms/sqlrooms/issues/182)) ([0b4d55f](https://github.com/sqlrooms/sqlrooms/commits/0b4d55ff407b6a978acb47fecc3dd71203df3a69))

# 0.26.0-rc.3 (2025-10-23)

### Features

* migrate to ai sdk v5 ([#166](https://github.com/sqlrooms/sqlrooms/issues/166)) ([f69529b](https://github.com/sqlrooms/sqlrooms/commits/f69529bb30cd9bfd85fb9b2c6a16a6769ae92061))

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
