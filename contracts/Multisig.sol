// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import 'forge-std/console.sol';

enum Action {
  None,
  Welcome,
  Kick,
  Leave,
  Withdraw
}
struct Operation {
  Action action;
  bytes params;
}

contract Multisig {
  error Unauthorized();
  address[] public membersAddress;
  Operation[] public operations;

  constructor() payable {
    operations.push(Operation(Action.None, ''));
    membersAddress.push(msg.sender);
  }

  receive() external payable {}

  function withdraw() internal {
    if (address(this).balance < 0) return;
    uint256 balance = address(this).balance;
    for (uint i = 0; i < membersAddress.length; i++) {
      payable(membersAddress[i]).transfer(balance / membersAddress.length);
    }
  }

  function welcome(bytes memory addr) internal {
    operations.push(Operation(Action.None, ''));
    membersAddress.push(address(bytes20(bytes(addr))));
  }

  function removeMember(uint index) internal {
    for (uint i = index; i < membersAddress.length - 1; i++) {
      membersAddress[i] = membersAddress[i + 1];
      operations[i] = operations[i + 1];
    }
    delete membersAddress[membersAddress.length - 1];
    delete operations[membersAddress.length - 1];
    membersAddress.pop();
    operations.pop();
  }

  function resetOperations(uint[] memory indexes) internal {
    for (uint i = 0; i < indexes.length; i++) {
      if (indexes[i] == 1) {
        operations[i] = Operation(Action.None, '');
      }
    }
  }

  // Welcome and Kick have address as param
  function eventuallyWithdraw(Action action) internal {
    uint sameVotes = 0;
    uint[] memory sameVotesIndexes = new uint[](membersAddress.length);
    for (uint i = 0; i < membersAddress.length; i++) {
      if (action == operations[i].action) {
        sameVotes += 1;
        sameVotesIndexes[i] = 1;
      }
    }
    if ((1000000 * sameVotes) / membersAddress.length > 666665) {
      console.log('more than 2/3 have voted withdraw');
      withdraw();
      resetOperations(sameVotesIndexes);
    }
  }

  function eventuallyWelcomeOrKick(Action action, bytes memory addr) internal {
    // addr may be 1 address or a
    // list of concatenated addresses
    /* for (uint i = 0; i < addr.length; i++) {
      console.logBytes(addr);
      console.logBytes8(bytes8(addr[i]));
    } */
    uint sameVotes = 0;
    uint[] memory sameVotesIndexes = new uint[](membersAddress.length);
    for (uint i = 0; i < membersAddress.length; i++) {
      if (
        action == operations[i].action &&
        keccak256(abi.encodePacked(addr)) ==
        keccak256(abi.encodePacked(operations[i].params))
      ) {
        sameVotes += 1;
        sameVotesIndexes[i] = 1;
      }
    }

    if ((1000000 * sameVotes) / membersAddress.length > 666665) {
      if (action == Action.Welcome) {
        console.log('more than 2/3 have voted welcome');
        resetOperations(sameVotesIndexes);
        welcome(addr);
      } else if (action == Action.Kick) {
        console.log('more than 2/3 have voted kick');
        uint indexOfMemberToKick = 0;
        for (uint i = 0; i < membersAddress.length; i++) {
          if (membersAddress[i] == address(bytes20(addr))) {
            indexOfMemberToKick = i;
          }
        }
        resetOperations(sameVotesIndexes);
        removeMember(indexOfMemberToKick);
      }
    }
  }

  function vote(Action action, bytes calldata params) external {
    bool authorized = false;
    uint index = 0;
    for (uint i = 0; i < membersAddress.length; i++) {
      if (membersAddress[i] == msg.sender) {
        index = i;
        authorized = true;
      }
    }
    if (authorized == false) {
      revert Unauthorized();
    }

    if (action == Action.Welcome) {
      operations[index] = Operation(action, params);
      eventuallyWelcomeOrKick(action, params);
    } else if (action == Action.Kick) {
      operations[index] = Operation(action, params);
      eventuallyWelcomeOrKick(action, params);
    } else if (action == Action.Leave) {
      removeMember(index);
    } else if (action == Action.Withdraw) {
      operations[index] = Operation(action, params);
      eventuallyWithdraw(action);
    }
  }
}
