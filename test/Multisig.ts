import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { request } from 'undici';

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { calculateSum, generateProducts } from '../utils/helpers';

const Actions = {
  None: 0,
  Welcome: '01',
  Kick: '02',
  Leave: '03',
  Withdraw: '04',
};
describe('Multisig contract 2-3 users', function () {
  async function deploy() {
    const [userAWallet, userBWallet, userCWallet] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('Multisig');
    const instance = await Factory.deploy({ value: 1000000 });

    return { instance, userAWallet, userBWallet, userCWallet };
  }

  let instance = null;
  let userAWallet = null;
  let userBWallet = null;
  let userCWallet = null;
  it('deploys', async function () {
    const loaded = await loadFixture(deploy);
    instance = loaded.instance;
    userAWallet = loaded.userAWallet;
    userBWallet = loaded.userBWallet;
    userCWallet = loaded.userCWallet;
    const bal = await instance.provider.getBalance(instance.address);
    expect(
      (await instance.provider.getBalance(instance.address)).eq(
        ethers.BigNumber.from('1000000')
      )
    ).to.equal(true);
    expect(typeof instance.address).to.equal('string');
  });

  it('userA (1/1) welcomes userB in multisig', async function () {
    const buf =
      Buffer.from(`0x${Actions.Welcome}`) +
      Buffer.from(userBWallet.address).slice(2);
    await instance.vote(buf);
    await instance.execute(buf);
    // operations[0] = [Action.Welcome, [userBWallet.address]]
    let member1Operation = await instance.operations(0);
    expect(await instance.membersAddress(0)).to.equal(userAWallet.address);
    expect(await instance.membersAddress(1)).to.equal(userBWallet.address);
    // check that operation has been
    // rest to None
    expect(member1Operation).to.equal('0x');
  });

  it('userC tries and fails to vote (Unauthorized)', async function () {
    let unauthorized = true;
    try {
      await instance
        .connect(userCWallet)
        .vote(
          Buffer.from(`0x${Actions.Welcome}`) +
            Buffer.from(userCWallet.address).slice(2)
        );
    } catch (err) {
      if (err.toString().includes('Unauthorized()')) unauthorized = true;
    }
    expect(unauthorized).to.equal(true);
  });

  it('userA and userB (2/2) welcome userC in multisig', async function () {
    const bufWelcomeUserC =
      Buffer.from(`0x${Actions.Welcome}`) +
      Buffer.from(userCWallet.address).slice(2);
    // reaches 50% of votes
    await instance.vote(bufWelcomeUserC);
    await instance.execute(bufWelcomeUserC);
    let member3Address = null;
    try {
      member3Address = await instance.membersAddress(2);
    } catch (err) {
      // do nothing, throw expected
    }
    expect(member3Address).to.equal(null);
    // connect as user2, vote for user3
    // reaches 100% of votes
    await instance.connect(userBWallet).vote(bufWelcomeUserC);
    await instance.connect(userBWallet).execute(bufWelcomeUserC);
    expect(await instance.membersAddress(2)).to.equal(userCWallet.address);
  });

  it('userA leaves', async function () {
    await instance.vote(
      Buffer.from(`0x${Actions.Leave}`) + Buffer.from(''.padEnd(40, '0'))
    );
    let member3Address = null;
    let member3Operation = null;
    try {
      member3Address = await instance.membersAddress(2);
    } catch (err) {
      // do nothing, throw expected
    }
    try {
      member3Operation = await instance.membersAddress(2);
    } catch (err) {
      // do nothing, throw expected
    }
    expect(member3Address).to.equal(null);
    expect(member3Operation).to.equal(null);
  });

  it('userB and userC (2/2) welcome userA back', async function () {
    const bufWelcomeUserA =
      Buffer.from(`0x${Actions.Welcome}`) +
      Buffer.from(userAWallet.address).slice(2);
    await instance.connect(userBWallet).vote(bufWelcomeUserA);
    await instance.connect(userCWallet).vote(bufWelcomeUserA);
    await instance.connect(userCWallet).execute(bufWelcomeUserA);
    expect(await instance.membersAddress(0)).to.equal(userBWallet.address);
    expect(await instance.membersAddress(1)).to.equal(userCWallet.address);
    expect(await instance.membersAddress(2)).to.equal(userAWallet.address);
  });

  it('userB and userC (2/3) kick userA out of multisig', async function () {
    const bufKickUserA =
      Buffer.from(`0x${Actions.Kick}`) +
      Buffer.from(userAWallet.address).slice(2);
    await instance.connect(userBWallet).vote(bufKickUserA);
    await instance.connect(userCWallet).vote(bufKickUserA);
    await instance.connect(userCWallet).execute(bufKickUserA);
    let member3Address = null;
    try {
      member3Address = await instance.membersAddress(2);
    } catch (err) {
      // do nothing, throw expected
    }
    expect(member3Address).to.equal(null);
    expect(await instance.membersAddress(0)).to.equal(userBWallet.address);
    expect(await instance.membersAddress(1)).to.equal(userCWallet.address);
    let unauthorized = true;
    try {
      await instance
        .connect(userAWallet)
        .vote(
          Buffer.from(`0x${Actions.Welcome}`) +
            Buffer.from(userAWallet.address).slice(2)
        );
    } catch (err) {
      if (err.toString().includes('Unauthorized()')) unauthorized = true;
    }
    expect(unauthorized).to.equal(true);
  });

  it('userB and userC (2/2) welcome+kick userA (batch)', async function () {
    const welcomeABuffer =
      Buffer.from(`0x${Actions.Welcome}`) +
      Buffer.from(userAWallet.address).slice(2);
    const kickABuffer =
      Buffer.from(`0x${Actions.Kick}`) +
      Buffer.from(userAWallet.address).slice(2);
    await instance
      .connect(userBWallet)
      .vote(welcomeABuffer + kickABuffer.slice(2));
    await instance
      .connect(userCWallet)
      .vote(welcomeABuffer + kickABuffer.slice(2));
    await instance
      .connect(userCWallet)
      .execute(welcomeABuffer + kickABuffer.slice(2));
    let member3Address = null;
    try {
      member3Address = await instance.membersAddress(2);
    } catch (err) {
      // do nothing, throw expected
    }
    expect(member3Address).to.equal(null);
    expect(await instance.membersAddress(0)).to.equal(userBWallet.address);
    expect(await instance.membersAddress(1)).to.equal(userCWallet.address);
  });

  it('userB and userC (2/2) withdraw the 1.000.000 wei', async function () {
    const bufWithdraw =
      Buffer.from(`0x${Actions.Withdraw}`) + Buffer.from(''.padEnd(40, '0'));
    await instance.connect(userBWallet).vote(bufWithdraw);
    const balB = await instance.provider.getBalance(userBWallet.address);
    await instance.connect(userCWallet).vote(bufWithdraw);
    await instance.connect(userCWallet).execute(bufWithdraw);
    expect(
      (await instance.provider.getBalance(userBWallet.address))
        .sub(balB)
        .eq(ethers.BigNumber.from('500000'))
    ).to.equal(true);

    // operations have been reset
    const member1Operation = await instance.operations(0);
    expect(member1Operation).to.equal('0x');
    const member2Operation = await instance.operations(1);
    expect(member2Operation).to.equal('0x');
    expect(
      (await instance.provider.getBalance(instance.address)).eq(
        ethers.BigNumber.from('0')
      )
    ).to.equal(true);
  });
});

describe('Multisig contract 20 users', function () {
  async function deploy() {
    const [userAWallet, userBWallet, userCWallet] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('Multisig');
    const instance = await Factory.deploy({ value: 1000000 });

    return { instance, userAWallet, userBWallet, userCWallet };
  }

  let instance = null;
  let nbUsers = 20;
  let userAWallet = null;
  let userBWallet = null;
  let userCWallet = null;
  const wallets = [];
  it('deploys and transfer ETH', async function () {
    const loaded = await loadFixture(deploy);
    instance = loaded.instance;
    userAWallet = loaded.userAWallet;
    for (let i = 0; i < nbUsers; i += 1) {
      const id = crypto.randomBytes(32).toString('hex');
      const privateKey = '0x' + id;
      const w = new ethers.Wallet(privateKey, instance.provider);

      wallets.push(w);
    }

    userBWallet = loaded.userBWallet;
    userCWallet = loaded.userCWallet;
    const bal = await instance.provider.getBalance(instance.address);

    for (const w of wallets) {
      const tx = await userAWallet.sendTransaction({
        to: w.getAddress(),
        value: ethers.BigNumber.from('10000000000000000').toString(),
      });
    }

    expect(
      (await instance.provider.getBalance(wallets[0].address)).eq(
        ethers.BigNumber.from('10000000000000000')
      )
    ).to.equal(true);
    expect(typeof instance.address).to.equal('string');
  });

  it('welcome 20 users in multisig', async function () {
    const bufWelcomeAllWallets =
      '0x' +
      wallets
        .map((w) => {
          return Buffer.from(`${Actions.Welcome}${w.address.slice(2)}`);
        })
        .join('');
    await instance.vote(bufWelcomeAllWallets);
    await instance.execute(bufWelcomeAllWallets);

    const member21peration = await instance.operations(20);
    expect(member21peration).to.equal('0x');
    let member22peration = null;
    try {
      member22peration = await instance.operations(21);
    } catch (err) {
      // do nothing, throw expected
    }
    expect(member22peration).to.equal(null);
  });
  it('14 users (66%) vote for kicking 7 others', async function () {
    const group1 = wallets.slice(0, 13);
    const group2 = wallets.slice(13);

    const iface = new ethers.utils.Interface([
      'function vote(bytes calldata params)',
      'function execute(bytes calldata params)',
    ]);

    // group 2 want to kick group1 out
    // nothing happens
    const bufGroup1Kicked =
      Buffer.from(`0x`) +
      Buffer.concat(
        group1.map((w) => Buffer.from(`${Actions.Kick}${w.address.slice(2)}`))
      );
    for (const wallet of group2) {
      await wallet.sendTransaction({
        to: instance.address,
        value: '0',
        data: iface.encodeFunctionData('vote', [bufGroup1Kicked]),
      });
    }
    await group2[group2.length - 1].sendTransaction({
      to: instance.address,
      value: '0',
      data: iface.encodeFunctionData('execute', [bufGroup1Kicked]),
    });

    // group 1 + user A (14) kick group 2
    const bufGroup2Kicked =
      Buffer.from(`0x`) +
      Buffer.concat(
        group2.map((w) => Buffer.from(`${Actions.Kick}${w.address.slice(2)}`))
      );
    for (const wallet of group1.concat(userAWallet)) {
      await wallet.sendTransaction({
        to: instance.address,
        value: '0',
        data: iface.encodeFunctionData('vote', [bufGroup2Kicked]),
      });
    }
    await group1[group1.length - 1].sendTransaction({
      to: instance.address,
      value: '0',
      data: iface.encodeFunctionData('execute', [bufGroup2Kicked]),
    });

    // group1 : 13 wallets + userA = 14
    expect(await instance.operations(13)).to.equal('0x');
    // only 14 members
    let member15peration = null;
    try {
      member15peration = await instance.operations(14);
    } catch (err) {
      // do nothing, throw expected
    }
    expect(member15peration).to.equal(null);
  });
});
