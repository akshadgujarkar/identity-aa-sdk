// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SmartAccount} from "./SmartAccount.sol";

/**
 * @title SmartAccountFactory
 * @notice Factory for deterministic CREATE2 deployment of SmartAccount (Phase 0 Setup)
 */
contract SmartAccountFactory {
    address public immutable entryPoint;

    event AccountCreated(address indexed account, address indexed owner, bytes32 salt);

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }

    function getAddress(address owner, bytes32 salt) public view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(abi.encodePacked(type(SmartAccount).creationCode, abi.encode(entryPoint, owner)))
            )
        );
        return address(uint160(uint256(hash)));
    }

    function createAccount(address owner, bytes32 salt) external returns (SmartAccount ret) {
        address addr = getAddress(owner, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return SmartAccount(payable(addr));
        }
        ret = new SmartAccount{salt: salt}(entryPoint, owner);
        emit AccountCreated(address(ret), owner, salt);
    }
}
