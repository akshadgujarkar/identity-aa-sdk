// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title SmartAccount
 * @notice Single-owner ERC-4337 Smart Account scaffold (Phase 0 Setup)
 */
contract SmartAccount {
    address public immutable entryPoint;
    address public owner;

    event SmartAccountInitialized(address indexed entryPoint, address indexed owner);

    constructor(address _entryPoint, address _owner) {
        entryPoint = _entryPoint;
        owner = _owner;
        emit SmartAccountInitialized(_entryPoint, _owner);
    }
}
