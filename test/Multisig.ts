import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import * as fs from 'fs';
import { request } from 'undici';

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { calculateSum, generateProducts } from '../utils/helpers';

const Actions = {
  None: 0,
  Welcome: 1,
  Kick: 2,
  Leave: 3,
  Withdraw: 4,
};
describe('Multisig contract Tests', function () {
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
    console.log('js', userBWallet.address);
    console.log(
      'js',
      Buffer.from('0x01') + Buffer.from(userBWallet.address).slice(2)
    );
    await instance.vote(
      Buffer.from('0x01') + Buffer.from(userBWallet.address).slice(2)
    );
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
        .vote(Buffer.from('0x01') + Buffer.from(userCWallet.address).slice(2));
    } catch (err) {
      if (err.toString().includes('Unauthorized()')) unauthorized = true;
    }
    expect(unauthorized).to.equal(true);
  });

  it('userA and userB (2/2) welcome userC in multisig', async function () {
    // reaches 50% of votes
    await instance.vote(
      Buffer.from('0x01') + Buffer.from(userCWallet.address).slice(2)
    );
    let member3Address = null;
    try {
      member3Address = await instance.membersAddress(2);
    } catch (err) {
      // do nothing, throw expected
    }
    expect(member3Address).to.equal(null);
    // connect as user2, vote for user3
    // reaches 100% of votes
    await instance
      .connect(userBWallet)
      .vote(Buffer.from('0x01') + Buffer.from(userCWallet.address).slice(2));
    expect(await instance.membersAddress(2)).to.equal(userCWallet.address);
  });

  it('userA leaves', async function () {
    await instance.vote(Buffer.from('0x03') + Buffer.from(''.padEnd(40, '0')));
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
    await instance
      .connect(userBWallet)
      .vote(Buffer.from('0x01') + Buffer.from(userAWallet.address).slice(2));
    await instance
      .connect(userCWallet)
      .vote(Buffer.from('0x01') + Buffer.from(userAWallet.address).slice(2));
    expect(await instance.membersAddress(0)).to.equal(userBWallet.address);
    expect(await instance.membersAddress(1)).to.equal(userCWallet.address);
    expect(await instance.membersAddress(2)).to.equal(userAWallet.address);
  });

  it('userB and userC (2/3) kick userA out of multisig', async function () {
    await instance
      .connect(userBWallet)
      .vote(Buffer.from('0x02') + Buffer.from(userAWallet.address).slice(2));
    await instance
      .connect(userCWallet)
      .vote(Buffer.from('0x02') + Buffer.from(userAWallet.address).slice(2));
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
        .vote(Buffer.from('0x01') + Buffer.from(userAWallet.address).slice(2));
    } catch (err) {
      if (err.toString().includes('Unauthorized()')) unauthorized = true;
    }
    expect(unauthorized).to.equal(true);
  });

  it('userB and userC (2/2) welcome+kick userA (batch)', async function () {
    const welcomeABuffer =
      Buffer.from('0x01') + Buffer.from(userAWallet.address).slice(2);
    const kickABuffer =
      Buffer.from('0x02') + Buffer.from(userAWallet.address).slice(2);
    await instance
      .connect(userBWallet)
      .vote(welcomeABuffer + kickABuffer.slice(2));
    await instance
      .connect(userCWallet)
      .vote(welcomeABuffer + kickABuffer.slice(2));
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
    console.log(Buffer.from('0x04') + Buffer.from(''.padEnd(20, '0')));
    await instance
      .connect(userBWallet)
      .vote(Buffer.from('0x04') + Buffer.from(''.padEnd(40, '0')));
    const balB = await instance.provider.getBalance(userBWallet.address);
    await instance
      .connect(userCWallet)
      .vote(Buffer.from('0x04') + Buffer.from(''.padEnd(40, '0')));
    expect(
      (await instance.provider.getBalance(userBWallet.address))
        .sub(balB)
        .eq(ethers.BigNumber.from('500000'))
    ).to.equal(true);

    // operations have been reset
    let member1Operation = await instance.operations(0);
    console.log('member1Operation');
    console.log(member1Operation);
    expect(member1Operation).to.equal('0x');
    let member2Operation = await instance.operations(1);
    expect(member2Operation).to.equal('0x');
    expect(
      (await instance.provider.getBalance(instance.address)).eq(
        ethers.BigNumber.from('0')
      )
    ).to.equal(true);
  });
});
