# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [2.0.0](https://github.com/blockstack/blockstack.js/compare/v2.0.0-beta.1...v2.0.0) (2021-07-19)


### Bug Fixes

* always return string quoted integer rather than `number | string` depending on bit size ([8e99b76](https://github.com/blockstack/blockstack.js/commit/8e99b763fbbd486cce87749e9e1b21015c61e946))
* bn.js lib accepts strings containing non-integer values and results in weird behavior ([786c3b2](https://github.com/blockstack/blockstack.js/commit/786c3b247c67cad4f7b4bb219fa19208ea583c2d))
* handle empty list in getCVTypeString ([#1033](https://github.com/blockstack/blockstack.js/issues/1033)) ([3b46674](https://github.com/blockstack/blockstack.js/commit/3b4667494725d0f1c2e17ca7d1f4ce01be969189))
* prettify ([9045f57](https://github.com/blockstack/blockstack.js/commit/9045f5726fd3544fda3f276daa89142158c8da1b))
* The transaction ABI validation should accept lists that are less than or equal to the max size specified in the arguments type ([c2262cc](https://github.com/blockstack/blockstack.js/commit/c2262cca82fac2e9b624b9ddbe7a298aaca29b92))


### Features

* refactor all js `number` and `bn.js` usages in Clarity integer values to native bigint ([1d0908e](https://github.com/blockstack/blockstack.js/commit/1d0908ef67cafbc09623adbcac54d85e92e174a0))





## [1.4.1](https://github.com/blockstack/blockstack.js.gi/compare/v1.4.1-alpha.0...v1.4.1) (2021-04-20)

**Note:** Version bump only for package @stacks/transactions





## [1.3.5](https://github.com/blockstack/blockstack.js.gi/compare/v1.3.4...v1.3.5) (2021-03-26)


### Bug Fixes

* use spending conditions key encoding to properly recover public key ([a0dbba8](https://github.com/blockstack/blockstack.js.gi/commit/a0dbba8710a2e9e2b5690b8f380c7b9d1db41875))





## [1.3.3](https://github.com/blockstack/blockstack.js.gi/compare/v1.3.2...v1.3.3) (2021-03-18)


### Bug Fixes

* export cvToValue function ([42c138b](https://github.com/blockstack/blockstack.js.gi/commit/42c138b975ea08e75fea78db39b77166c08f193b))





# [1.3.0](https://github.com/blockstack/blockstack.js.gi/compare/v1.2.4...v1.3.0) (2021-03-08)


### Features

* add hex string and Buffer support to `deserializedTransaction` ([be379b2](https://github.com/blockstack/blockstack.js.gi/commit/be379b257a31329618e5e9db91e25bbe3bef1b61))
* properly serialize uncompressed auth fields ([e259fe1](https://github.com/blockstack/blockstack.js.gi/commit/e259fe176478c3ae35f1d12d9f77be377c167f65))





## [1.2.4](https://github.com/blockstack/blockstack.js.gi/compare/v1.2.3...v1.2.4) (2021-02-26)

**Note:** Version bump only for package @stacks/transactions





## [1.2.3](https://github.com/blockstack/blockstack.js.gi/compare/v1.2.2...v1.2.3) (2021-02-25)


### Bug Fixes

* export cvToValue function ([835e68e](https://github.com/blockstack/blockstack.js.gi/commit/835e68e14e346c2417ac21c1c85bdc68d3de6e2e))
