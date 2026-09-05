// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Paymaster
 * @notice Demo gas sponsorship Paymaster scaffold (Phase 0 Setup)
 */
contract Paymaster {
    address public immutable entryPoint;
    address public owner;

    event PaymasterFunded(uint256 amount);

    constructor(address _entryPoint, address _owner) {
        entryPoint = _entryPoint;
        owner = _owner;
    }

    receive() external payable {
        emit PaymasterFunded(msg.value);
    }
}
