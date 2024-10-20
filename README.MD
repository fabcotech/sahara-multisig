![Sahara multisig](https://raw.githubusercontent.com/fabcotech/sahara-multisig/refs/heads/master/assets/saharamultisig.jpg)

# Sahara multisig

Sahara Multisig is a new kind of dynamic-membership multisig for EVM-based blockchains.

The membership is dynamic, new members may join and/or be kicked over the lifetime of the contract. At any time, members can cast a vote (ex: _"kick 0xabcdef"_, _"welcome 0xhijklm"_), if 66.6% threshold is reached (same vote for 66.6%+ members), the action is executed.

### Actions

4 Actions :

- **None (0)**: null/nothing vote.
- **Welcome (1)**: Welcome a user into the multisig, identified by Ethereum address.
- **Kick (2)**: Kick a user from the multisig.
- **Leave (3)**: Leave the multisig, not subjected to the 66.6% rule, can be executed unilaterally.
- **Withdraw (4)**: Divide the contract's balance by the number of members, transfer equal portion to each.
- **WithdrawToken (5)**: _(Coming soon)_ Same but for ERC20 token (ex: USDC, USDT etc.)
- **UdateTheshold (6)**: _(Coming soon)_ Update threshold to another value (50%, 90%, else).

Contract is protected from replay attacks, anytime an action is executed, majority votes are reset to **None (0)**, minority votes are left unchanged.

### Recursiveness

A multisig contract can be member of another multisig.

### Test (hardhat)

```sh
npm i
npm run test
```

### Deploy

_Coming soon_

### Command Line Interface

_Coming soon_

We're soon releasing a CLI to deploy, interact with and monitor a Sahara Multisig contract.

### History

This repo is a solidity release of a multisig contrct based on RChain/rholang I developed few years ago.
