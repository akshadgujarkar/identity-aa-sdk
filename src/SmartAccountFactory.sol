// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {SmartAccount} from "./SmartAccount.sol";

/**
 * @title SmartAccountFactory
 * @notice Factory for deterministic CREATE2 deployment of ERC-4337 Smart Accounts.
 * Specification from docs/ACCOUNT_FACTORY.md.
 */
contract SmartAccountFactory {
    IEntryPoint public immutable ENTRY_POINT;

    event AccountCreated(address indexed account, address indexed owner, bytes32 salt);

    /**
     * @param anEntryPoint The canonical EntryPoint contract.
     */
    constructor(IEntryPoint anEntryPoint) {
        ENTRY_POINT = anEntryPoint;
    }

    /**
     * @notice Computes the counterfactual CREATE2 address for a Smart Account before deployment.
     * @param owner The initial owner address for the account.
     * @param salt Deterministic salt derived from AccountKey.
     * @return The calculated contract address.
     */
    function getAddress(address owner, bytes32 salt) public view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(SmartAccount).creationCode,
            abi.encode(ENTRY_POINT, owner)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }

    /**
     * @notice Deploys a SmartAccount deterministically using CREATE2.
     * @dev Idempotent: returns the deployed address if the contract already exists.
     * @param owner The initial owner address for the account.
     * @param salt Deterministic salt derived from AccountKey.
     * @return ret The deployed or existing SmartAccount instance.
     */
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
