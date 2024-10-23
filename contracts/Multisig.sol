// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import 'forge-std/console.sol';

contract Multisig {
  error Unauthorized();
  address[] public membersAddress;
  bytes[] public operations;

  constructor() payable {
    operations.push(bytes(''));
    membersAddress.push(msg.sender);
  }

  receive() external payable {}

  /// @notice Withdraw contract balance to multisig members
  function withdraw() internal {
    if (address(this).balance < 1) return;
    uint256 balance = address(this).balance;
    for (uint i = 0; i < membersAddress.length; i++) {
      payable(membersAddress[i]).transfer(balance / membersAddress.length);
    }
  }

  /// @notice Add a new member in multisig
  /// @param addr address as bytes
  function welcome(bytes memory addr) internal {
    console.log('== welcome');
    operations.push(bytes(''));
    membersAddress.push(address(bytes20(bytes(addr))));
  }

  /// @notice Removes a member from the multisig
  /// @param index index of the member to remove in membersAddress and operations arrays
  function removeMember(uint index) internal {
    console.log('== removeMember');
    for (uint i = index; i < membersAddress.length - 1; i++) {
      membersAddress[i] = membersAddress[i + 1];
      operations[i] = operations[i + 1];
    }
    delete membersAddress[membersAddress.length - 1];
    delete operations[membersAddress.length - 1];
    membersAddress.pop();
    operations.pop();
  }

  /// @notice Reset operations for a set of addresses
  /// @param addresses array of addresses for which to reset
  function resetOperations(address[] memory addresses) internal {
    for (uint i = 0; i < addresses.length; i++) {
      for (uint j = 0; j < membersAddress.length; j++) {
        if (membersAddress[j] == addresses[i]) {
          operations[i] = bytes('');
          break;
        }
      }
    }
  }

  function bytesToUint(bytes memory b) internal pure returns (uint256) {
    uint256 number;
    for (uint i = 0; i < b.length; i++) {
      number = number + uint(uint8(b[i])) * (2 ** (8 * (b.length - (i + 1))));
    }
    return number;
  }

  /// @notice Counts all votes with same bytes, and checks for 66.6% threshold for execution
  /// @param params will process only votes with same bytes
  function eventuallyExecute(bytes calldata params) internal {
    if (params.length == 0) {
      return;
    }
    uint sameVotes = 0;
    address[] memory sameVotesAddresses = new address[](membersAddress.length);
    for (uint i = 0; i < membersAddress.length; i++) {
      // todo
      // return if we know threshold will not be reached
      if (
        keccak256(abi.encodePacked(params)) ==
        keccak256(abi.encodePacked(operations[i]))
      ) {
        sameVotes += 1;
        sameVotesAddresses[i] = membersAddress[i];
      }
    }

    if ((1000000 * sameVotes) / membersAddress.length > 666665) {
      console.log('more than 2/3 have voted same set of actions');
      uint256 i = 0;
      while (i < params.length) {
        bytes memory action = params[0 + i:1 + i];
        // Welcome
        if (bytesToUint(action) == 1) {
          bytes memory addr = params[1 + i:21 + i];
          welcome(addr);
          // Kick
        } else if (bytesToUint(action) == 2) {
          bytes memory addr = params[1 + i:21 + i];
          uint membersAddressLength = membersAddress.length;
          for (uint j = 0; j < membersAddressLength; j++) {
            if (membersAddress[j] == address(uint160(bytes20(addr)))) {
              removeMember(j);
              break;
            }
          }
          // Withdraw
        } else if (bytesToUint(action) == 4) {
          withdraw();
        }
        i += 21;
      }
      resetOperations(sameVotesAddresses);
    }
  }

  /// @notice Triggers eventuallyExecute function
  /// @param params will process only votes with same bytes
  function execute(bytes calldata params) external {
    // params must be an array of 21 bytes chunks
    // [byte1: action, byte2-21: address]
    require(params.length % 21 == 0, 'params.length % 21 != 0');
    eventuallyExecute(params);
  }

  /// @notice Records the vote of a member
  function vote(bytes calldata params) external {
    // params must be an array of 21 bytes chunks
    // [byte1: action, byte2-21: address]
    require(params.length % 21 == 0, 'params.length % 21 != 0');
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

    // first action may be Leave
    bytes memory action = params[0:1];
    if (bytesToUint(action) == 3) {
      removeMember(index);
    } else {
      operations[index] = params;
    }
  }
}
