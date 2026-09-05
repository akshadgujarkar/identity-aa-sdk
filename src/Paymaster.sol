// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";

/**
 * @title Paymaster
 * @notice Demo gas sponsorship Paymaster scaffold (Phase 0/2).
 */
contract Paymaster {
    IEntryPoint public immutable ENTRY_POINT;
    address public owner;

    event PaymasterFunded(uint256 amount);

    constructor(IEntryPoint anEntryPoint, address anOwner) {
        ENTRY_POINT = anEntryPoint;
        owner = anOwner;
    }

    receive() external payable {
        emit PaymasterFunded(msg.value);
    }
}
