# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [2.0.0](https://github.com/blockstack/blockstack.js/compare/v2.0.0-beta.1...v2.0.0) (2021-07-19)


### Bug Fixes

* add missing stx burn and NFT post conditions ([9165c2a](https://github.com/blockstack/blockstack.js/commit/9165c2a11b71176650c8ca2c4a8183e705e5c37e))
* always return string quoted integer rather than `number | string` depending on bit size ([8e99b76](https://github.com/blockstack/blockstack.js/commit/8e99b763fbbd486cce87749e9e1b21015c61e946))
* bn.js lib accepts strings containing non-integer values and results in weird behavior ([786c3b2](https://github.com/blockstack/blockstack.js/commit/786c3b247c67cad4f7b4bb219fa19208ea583c2d))
* broken types following diverged network config changes ([03e0c1a](https://github.com/blockstack/blockstack.js/commit/03e0c1a3401f3f58f41933563e9eb4cef2df4830))
* fix optional argument encoding and update test cases in bns transferName, renewName calls ([6f4f8fa](https://github.com/blockstack/blockstack.js/commit/6f4f8fa67e208541adf9acbe780f74a8d002e5a2))
* fix stx balance command crash if address not valid ([8cc69df](https://github.com/blockstack/blockstack.js/commit/8cc69df21bc33eda6e9ec3cd6be6bfca2ec7b8ad))
* fixed lint issue ([14e48dc](https://github.com/blockstack/blockstack.js/commit/14e48dc9abface83ca6cbc9240b7c2e4960caa9f))
* handle empty list in getCVTypeString ([#1033](https://github.com/blockstack/blockstack.js/issues/1033)) ([3b46674](https://github.com/blockstack/blockstack.js/commit/3b4667494725d0f1c2e17ca7d1f4ce01be969189))
* prettify ([9045f57](https://github.com/blockstack/blockstack.js/commit/9045f5726fd3544fda3f276daa89142158c8da1b))
* remove console.log ([1a13af8](https://github.com/blockstack/blockstack.js/commit/1a13af8c0e00851be9ee27a53e67efdf589f5919))
* remove unused const ([709bd33](https://github.com/blockstack/blockstack.js/commit/709bd33966563cdefa186615ab221dc94efa2f7f))
* removeread only and add private field to prevent run time assignment ([29796ec](https://github.com/blockstack/blockstack.js/commit/29796ece1dd93869500068a2f8d1e5e4d7cfdf5f))
* The transaction ABI validation should accept lists that are less than or equal to the max size specified in the arguments type ([c2262cc](https://github.com/blockstack/blockstack.js/commit/c2262cca82fac2e9b624b9ddbe7a298aaca29b92))
* use stacks.js repo url ([dbcbcf9](https://github.com/blockstack/blockstack.js/commit/dbcbcf9ceca0e7e88fe9449efb52f57ce9912794))
* verify that the public key is a secp256k1 point ([cef1d5a](https://github.com/blockstack/blockstack.js/commit/cef1d5ab3bc61a172b65abc1cb5bf0865a34f7d9))


### Features

* add @stacks/wallet-sdk package ([e40785c](https://github.com/blockstack/blockstack.js/commit/e40785c2e70def0b106411b19f78a5b7290081c8))
* add regtest to list of available networks ([f572477](https://github.com/blockstack/blockstack.js/commit/f572477ca0e5bc5e862c8a4e2fcc276655ee55a3)), closes [#1041](https://github.com/blockstack/blockstack.js/issues/1041)
* refactor all js `number` and `bn.js` usages in Clarity integer values to native bigint ([1d0908e](https://github.com/blockstack/blockstack.js/commit/1d0908ef67cafbc09623adbcac54d85e92e174a0))





## [1.4.1](https://github.com/blockstack/blockstack.js/compare/v1.4.1-alpha.0...v1.4.1) (2021-04-20)

**Note:** Version bump only for package stacks.js





## [1.3.5](https://github.com/blockstack/blockstack.js/compare/v1.3.4...v1.3.5) (2021-03-26)


### Bug Fixes

* use spending conditions key encoding to properly recover public key ([a0dbba8](https://github.com/blockstack/blockstack.js/commit/a0dbba8710a2e9e2b5690b8f380c7b9d1db41875))





## [1.3.4](https://github.com/blockstack/blockstack.js/compare/v1.3.3...v1.3.4) (2021-03-18)


### Features

* export stacking/utils functions ([24c7314](https://github.com/blockstack/blockstack.js/commit/24c73148afafceb5be9e172a8bc325e1ad54a800))


### Reverts

* Revert "v1.4.0" ([4356ddb](https://github.com/blockstack/blockstack.js/commit/4356ddbc8d83a83c97efaf6d8d1a7abefbc4f6d9))





## [1.3.3](https://github.com/blockstack/blockstack.js/compare/v1.3.2...v1.3.3) (2021-03-18)


### Bug Fixes

* [#973](https://github.com/blockstack/blockstack.js/issues/973) stacking lib only allow p2pkh and p2sh btc addresses ([af00bd5](https://github.com/blockstack/blockstack.js/commit/af00bd5f315a4877f6af0fd71e6373d664afbe6a))
* export cvToValue function ([42c138b](https://github.com/blockstack/blockstack.js/commit/42c138b975ea08e75fea78db39b77166c08f193b))
* package.json to reduce vulnerabilities ([48a72fb](https://github.com/blockstack/blockstack.js/commit/48a72fba2eda7e5f0bc7dbd649f274f88d01bd1d))





## [1.3.2](https://github.com/blockstack/blockstack.js/compare/v1.3.1...v1.3.2) (2021-03-11)

**Note:** Version bump only for package stacks.js





## [1.3.1](https://github.com/blockstack/blockstack.js.gi/compare/v1.3.0...v1.3.1) (2021-03-10)

**Note:** Version bump only for package stacks.js





# [1.3.0](https://github.com/blockstack/blockstack.js.gi/compare/v1.2.4...v1.3.0) (2021-03-08)


### Features

* add hex string and Buffer support to `deserializedTransaction` ([be379b2](https://github.com/blockstack/blockstack.js.gi/commit/be379b257a31329618e5e9db91e25bbe3bef1b61))
* properly serialize uncompressed auth fields ([e259fe1](https://github.com/blockstack/blockstack.js.gi/commit/e259fe176478c3ae35f1d12d9f77be377c167f65))





## [1.2.4](https://github.com/blockstack/blockstack.js/compare/v1.2.3...v1.2.4) (2021-02-26)

**Note:** Version bump only for package stacks.js





## [1.2.3](https://github.com/blockstack/blockstack.js/compare/v1.2.2...v1.2.3) (2021-02-25)


### Bug Fixes

* don't multiply with cycleDuration ([a6fab4e](https://github.com/blockstack/blockstack.js/commit/a6fab4e5c3038cf4eaa7bd997b7d4c5104ca6858))
* export cvToValue function ([835e68e](https://github.com/blockstack/blockstack.js/commit/835e68e14e346c2417ac21c1c85bdc68d3de6e2e))
* getDelegateStxOptions ([42eea7e](https://github.com/blockstack/blockstack.js/commit/42eea7ec9da23fae67ea8499e0db51665acffe0e))
