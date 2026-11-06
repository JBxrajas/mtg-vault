# Changelog

## [0.5.0](https://github.com/JBxrajas/mtg-vault/compare/v0.4.0...v0.5.0) (2026-11-06)


### Features

* edit the edition of a collection stack and delete decks from the list ([#71](https://github.com/JBxrajas/mtg-vault/issues/71)) ([848259f](https://github.com/JBxrajas/mtg-vault/commit/848259f98bafec81b94676276849cda302c8e544))
* find cards by printed name, pick the printing by art, change a deck card's art ([#73](https://github.com/JBxrajas/mtg-vault/issues/73)) ([2e7b2f9](https://github.com/JBxrajas/mtg-vault/commit/2e7b2f9593be45fe2c2b405c7e8ea6cca176a9f4))
* turn double-faced cards over to see their other side ([#76](https://github.com/JBxrajas/mtg-vault/issues/76)) ([08dc5bd](https://github.com/JBxrajas/mtg-vault/commit/08dc5bdf3f01fda3c0ebb73417f804720a45b7db))
* **web:** add a landing page for visitors ([#69](https://github.com/JBxrajas/mtg-vault/issues/69)) ([29a2404](https://github.com/JBxrajas/mtg-vault/commit/29a2404ca8456ed44c75c995c6cb367758aee0a6))
* **web:** look for the card around the guide to recognise it ([#66](https://github.com/JBxrajas/mtg-vault/issues/66)) ([c79b269](https://github.com/JBxrajas/mtg-vault/commit/c79b269d4590404d9f920b14506a4c65d7d51898))
* **web:** redesign the collection filters and the decks screens ([#67](https://github.com/JBxrajas/mtg-vault/issues/67)) ([156eecf](https://github.com/JBxrajas/mtg-vault/commit/156eecf296f1e887a23601375c5166d5cbdee7a8))
* **web:** scan cards with the camera or photos into the collection or a deck ([#63](https://github.com/JBxrajas/mtg-vault/issues/63)) ([4a2551e](https://github.com/JBxrajas/mtg-vault/commit/4a2551e478be38303e50d1d5f8371cb02b74a624))


### Bug Fixes

* **api:** rank a card found by its printed name first in the search ([#75](https://github.com/JBxrajas/mtg-vault/issues/75)) ([4bb969a](https://github.com/JBxrajas/mtg-vault/commit/4bb969adef97a3eae307dd4254e7237eb0ca8926))
* **jobs:** publish the art index, and shrink images with one shared function ([#61](https://github.com/JBxrajas/mtg-vault/issues/61)) ([08df267](https://github.com/JBxrajas/mtg-vault/commit/08df26701f611b04dd5aed9aff41d703b5c020b9))
* **jobs:** skip printings whose set, number and language belong to another id ([#74](https://github.com/JBxrajas/mtg-vault/issues/74)) ([d5b47f6](https://github.com/JBxrajas/mtg-vault/commit/d5b47f6503022f9534b4593cdaf3863ae2f9b2e3))
* **web:** a color filter needs every color picked ([#72](https://github.com/JBxrajas/mtg-vault/issues/72)) ([369fed0](https://github.com/JBxrajas/mtg-vault/commit/369fed0ced56ef63eaa3adaefb19f7429d41e0d4))
* **web:** capture cards one after another by themselves ([#64](https://github.com/JBxrajas/mtg-vault/issues/64)) ([6f879b8](https://github.com/JBxrajas/mtg-vault/commit/6f879b8e1719f9b97cc8664bfb4d34a47ceeb4b5))
* **web:** close the results after adding a card to a deck ([#68](https://github.com/JBxrajas/mtg-vault/issues/68)) ([323da45](https://github.com/JBxrajas/mtg-vault/commit/323da4534fc4cb7d2e3becff2d6b6d2718a8e926))
* **web:** keep content readable over the art background ([#70](https://github.com/JBxrajas/mtg-vault/issues/70)) ([63f2678](https://github.com/JBxrajas/mtg-vault/commit/63f2678f1bd7e4ad14cf57a40f39d5004ff4bcb6))

## [0.4.0](https://github.com/JBxrajas/mtg-vault/compare/v0.3.0...v0.4.0) (2026-11-05)


### Features

* **api:** serve the art-fingerprint index ([#60](https://github.com/JBxrajas/mtg-vault/issues/60)) ([a60f5b3](https://github.com/JBxrajas/mtg-vault/commit/a60f5b3d90874272439ca67dde893edf543089bd))
* **jobs:** build an art-fingerprint index for card scanning ([#59](https://github.com/JBxrajas/mtg-vault/issues/59)) ([edf3ab7](https://github.com/JBxrajas/mtg-vault/commit/edf3ab72de2c0069d2fb678fabcfd3735d0810b5))
* **web:** commander-first deck flow with a visual guided start ([#53](https://github.com/JBxrajas/mtg-vault/issues/53)) ([6a9ff34](https://github.com/JBxrajas/mtg-vault/commit/6a9ff345d0f491b9b509b6c7702b4dc08f3d22e2))
* **web:** keep the commander in a sticky bar on the deck page ([#50](https://github.com/JBxrajas/mtg-vault/issues/50)) ([b18edd2](https://github.com/JBxrajas/mtg-vault/commit/b18edd2db1340171879408fe34dce5b1a43547cb))
* **web:** prices in Mexican pesos and a high-resolution art view ([#57](https://github.com/JBxrajas/mtg-vault/issues/57)) ([8237946](https://github.com/JBxrajas/mtg-vault/commit/82379463f4cc759c9dcf8e8977713f80c64e61a4))
* **web:** search, sorting and filters in the collection ([#56](https://github.com/JBxrajas/mtg-vault/issues/56)) ([e26582e](https://github.com/JBxrajas/mtg-vault/commit/e26582e7beda19bf40d3569774356955249a0e15))


### Bug Fixes

* **web:** keep the commander bar below the top bar, and add browser layout checks ([#52](https://github.com/JBxrajas/mtg-vault/issues/52)) ([78b4e7a](https://github.com/JBxrajas/mtg-vault/commit/78b4e7aa13e8f9ce0b988c52001d8a0e9f0469d1))
* **web:** show one big card at a time, and add the card preview to the collection ([#55](https://github.com/JBxrajas/mtg-vault/issues/55)) ([0c0d33b](https://github.com/JBxrajas/mtg-vault/commit/0c0d33b062dd62a0449db85a185e3ce237f3abd7))
* **web:** stop the guided deck step from stretching past a phone screen ([#54](https://github.com/JBxrajas/mtg-vault/issues/54)) ([85a27bd](https://github.com/JBxrajas/mtg-vault/commit/85a27bd531f4859bbd251fccab4a6d8dcba49625))

## [0.3.0](https://github.com/JBxrajas/mtg-vault/compare/v0.2.0...v0.3.0) (2026-11-04)


### Features

* add collection inventory API and screens ([#31](https://github.com/JBxrajas/mtg-vault/issues/31)) ([1fb8681](https://github.com/JBxrajas/mtg-vault/commit/1fb8681d660ffdb51d05f6242f658ece42146a82))
* add decks with type groups and owned badges ([#34](https://github.com/JBxrajas/mtg-vault/issues/34)) ([a315d76](https://github.com/JBxrajas/mtg-vault/commit/a315d76b0f8b05be2cf097be6805f787f908d764))
* add username and password login ([#29](https://github.com/JBxrajas/mtg-vault/issues/29)) ([3c0e8eb](https://github.com/JBxrajas/mtg-vault/commit/3c0e8eb9bcb24dac04bbb7ae0be2826b90f05427))
* Commander deck analysis, knowledge base and EDHREC link ([#49](https://github.com/JBxrajas/mtg-vault/issues/49)) ([edcea2e](https://github.com/JBxrajas/mtg-vault/commit/edcea2e7410040dd8487bf8ea91d8016a6b8909e))
* export the collection, import and export deck lists, pick the printing of the background art ([#43](https://github.com/JBxrajas/mtg-vault/issues/43)) ([78d6da7](https://github.com/JBxrajas/mtg-vault/commit/78d6da7e5079100bf7384ee32c9668c8a263808a))
* import a collection from a Moxfield CSV ([#36](https://github.com/JBxrajas/mtg-vault/issues/36)) ([80ebeb0](https://github.com/JBxrajas/mtg-vault/commit/80ebeb0a284bcf652e71cde3bd3b309035f8d5b6))
* list printings with set name and price ([#28](https://github.com/JBxrajas/mtg-vault/issues/28)) ([4a6677e](https://github.com/JBxrajas/mtg-vault/commit/4a6677ead3a9a496173d66e18fcbcc1048b7f9b3))
* modern mobile-first design ([#33](https://github.com/JBxrajas/mtg-vault/issues/33)) ([caccb92](https://github.com/JBxrajas/mtg-vault/commit/caccb9289572c570786d49e4341e1a4b577ce8f2))
* show card images in the search ([#26](https://github.com/JBxrajas/mtg-vault/issues/26)) ([a83ea70](https://github.com/JBxrajas/mtg-vault/commit/a83ea7081c10481212ab66cd92016358765e8254))
* **web:** add a Spanish interface with a language button ([#42](https://github.com/JBxrajas/mtg-vault/issues/42)) ([1bafdcc](https://github.com/JBxrajas/mtg-vault/commit/1bafdcc49819f93c10c36e66975b07f2b6470712))
* **web:** add help bubbles and a welcome panel that invites visitors to register ([#37](https://github.com/JBxrajas/mtg-vault/issues/37)) ([096bcea](https://github.com/JBxrajas/mtg-vault/commit/096bceab3c3f250cfe0a3e56a9ff017785aac689))
* **web:** let users pick light or dark, a background color or card art ([#41](https://github.com/JBxrajas/mtg-vault/issues/41)) ([dd589a8](https://github.com/JBxrajas/mtg-vault/commit/dd589a8e167f915c1296565c691512c88d4d734b))


### Bug Fixes

* build only main on Vercel to stay under the deployment limit ([#35](https://github.com/JBxrajas/mtg-vault/issues/35)) ([9a83c64](https://github.com/JBxrajas/mtg-vault/commit/9a83c64769bf8b95ccc53bb8ae87dd9f63013d46))
* **web:** clear cached account data on sign-out and sign-in ([#39](https://github.com/JBxrajas/mtg-vault/issues/39)) ([607aa10](https://github.com/JBxrajas/mtg-vault/commit/607aa103c72d874662330f537c9c870ba4f8de26))
* **web:** show sign-up errors per field and explain the search filters ([#38](https://github.com/JBxrajas/mtg-vault/issues/38)) ([0ca3474](https://github.com/JBxrajas/mtg-vault/commit/0ca347432ba8c445e9261589ffd7ad9be9420b21))
* **web:** stop the deck tabs from clipping the boards help bubble ([#44](https://github.com/JBxrajas/mtg-vault/issues/44)) ([d7d3855](https://github.com/JBxrajas/mtg-vault/commit/d7d38556ebe2581e0b8921fe1617230164d2fb22))


### Performance Improvements

* make the + and - buttons feel instant ([#40](https://github.com/JBxrajas/mtg-vault/issues/40)) ([2a0bb7d](https://github.com/JBxrajas/mtg-vault/commit/2a0bb7d05571a1bba2af03b2a1c52104aaca6cfa))

## [0.2.0](https://github.com/JBxrajas/mtg-vault/compare/v0.1.1...v0.2.0) (2026-11-04)


### Features

* add card name search endpoint ([#15](https://github.com/JBxrajas/mtg-vault/issues/15)) ([7466b58](https://github.com/JBxrajas/mtg-vault/commit/7466b58c18e8311ac0fa43f4b9938832cbad28e1))
* add card search page to the web app ([#24](https://github.com/JBxrajas/mtg-vault/issues/24)) ([abedeaf](https://github.com/JBxrajas/mtg-vault/commit/abedeafef1b10c02c73a00f16580544021efd7b7))
* add users, collection, binders and decks data model ([#25](https://github.com/JBxrajas/mtg-vault/issues/25)) ([4a635f1](https://github.com/JBxrajas/mtg-vault/commit/4a635f1f72c9a1d2f201dc16b06ad4daf42135a3))
* deploy the API as its own Vercel project with CORS ([#21](https://github.com/JBxrajas/mtg-vault/issues/21)) ([40e0740](https://github.com/JBxrajas/mtg-vault/commit/40e07400d86c7ff7eb65a24e18df8f09aa681d40))


### Bug Fixes

* bundle the API for Vercel so workspace packages resolve ([#22](https://github.com/JBxrajas/mtg-vault/issues/22)) ([c834625](https://github.com/JBxrajas/mtg-vault/commit/c8346254c84b4b567ce3f9ce78da11ca9343356b))

## [0.1.1](https://github.com/JBxrajas/mtg-vault/compare/v0.1.0...v0.1.1) (2026-11-04)


### Bug Fixes

* remove release-as now that v0.1.0 is published ([#13](https://github.com/JBxrajas/mtg-vault/issues/13)) ([923bd1e](https://github.com/JBxrajas/mtg-vault/commit/923bd1ea8bb97901600b0024053b81e8fbbf6a1f))

## 0.1.0 (2026-11-04)


### Features

* add catalog database schema ([#7](https://github.com/JBxrajas/mtg-vault/issues/7)) ([f81e5f4](https://github.com/JBxrajas/mtg-vault/commit/f81e5f40ea516ea456e95f9571016a27059c9b9f))
* add Scryfall catalog import job ([#10](https://github.com/JBxrajas/mtg-vault/issues/10)) ([daf4b73](https://github.com/JBxrajas/mtg-vault/commit/daf4b730619a3f7989af2203d0c1caf474614791))
* scaffold web app and add typecheck CI ([#3](https://github.com/JBxrajas/mtg-vault/issues/3)) ([9c81f5a](https://github.com/JBxrajas/mtg-vault/commit/9c81f5a3b93cb3a979bb5d7189c26448f32f7308))


### Bug Fixes

* pin first release to 0.1.0 ([#6](https://github.com/JBxrajas/mtg-vault/issues/6)) ([172986e](https://github.com/JBxrajas/mtg-vault/commit/172986eccc1614a5545b5ec470afef49366128c6))
* widen cards.cmc so oversized mana values import ([#11](https://github.com/JBxrajas/mtg-vault/issues/11)) ([19e5b47](https://github.com/JBxrajas/mtg-vault/commit/19e5b47207a784c32f02dc0e5fc23f445bd2c430))
