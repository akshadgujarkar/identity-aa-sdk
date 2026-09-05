// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {SmartAccount} from "./SmartAccount.sol";

/**
 * @title SmartAccountFactory
 * @notice Factory for deterministic CREATE2 deployment of SmartAccount.
 */
contract SmartAccountFactory {
    IEntryPoint public immutable ENTRY_POINT;

    event AccountCreated(address indexed account, address indexed owner, bytes32 salt);

    constructor(IEntryPoint anEntryPoint) {
        ENTRY_POINT = anEntryPoint;
    }

    function getAddress(address owner, bytes32 salt) public view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(abi.encodePacked(type(SmartAccount).creationCode, abi.encode(ENTRY_POINT, owner)))
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
        ret = new SmartAccount{salt: salt}(ENTRY_POINT, owner);
        emit AccountCreated(address(ret), owner, salt);
    }
}
