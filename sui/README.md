# GotBeef Sui package

## Dev setup
1. [Install Sui](https://docs.sui.io/build/install#install-sui-binaries)
```
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui sui-node
```
2. Connect to devnet:
```
sui client switch --env devnet
```

## How to run the unit tests
```
sui move test
```
Show test coverage:
```
sui move test --coverage && sui move coverage summary
sui move coverage source --module bet
sui move coverage bytecode --module bet
```

## How to publish the package
```
sui client publish --verify-dependencies --gas-budget 30000
```

## How to use from `sui console`
#### Fund a bet
```
call --package PACKAGE_ID --module bet --function fund --type-args 0x2::sui::SUI --args BET_ID COIN_ID --gas-budget 1000
```
