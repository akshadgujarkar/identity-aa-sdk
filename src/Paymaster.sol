// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {IPaymaster} from "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

/**
 * @title Paymaster
 * @notice ERC-4337 v0.7 Demo Gas Sponsorship Paymaster.
 * Validates that requests originate from the canonical EntryPoint and sponsors gas.
 * Specification from docs/GAS_ABSTRACTION.md and docs/phases/PHASE_08_GAS_SPONSORSHIP.md.
 */
contract Paymaster is IPaymaster {
    IEntryPoint public immutable ENTRY_POINT;
    address public owner;

    event PaymasterFunded(uint256 amount);
    event GasSponsored(bytes32 indexed userOpHash, address indexed sender, uint256 maxCost);
    event GasRefunded(bytes32 indexed userOpHash, address indexed sender, uint256 actualGasCost);

    error OnlyEntryPoint();
    error OnlyOwner();

    modifier onlyEntryPoint() {
        if (msg.sender != address(ENTRY_POINT)) {
            revert OnlyEntryPoint();
        }
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OnlyOwner();
        }
        _;
    }

    constructor(IEntryPoint anEntryPoint, address anOwner) {
        ENTRY_POINT = anEntryPoint;
        owner = anOwner;
    }

    receive() external payable {
        emit PaymasterFunded(msg.value);
    }

    /**
     * Deposits native token into EntryPoint for this paymaster's gas balance.
     */
    function deposit() external payable {
        ENTRY_POINT.depositTo{value: msg.value}(address(this));
        emit PaymasterFunded(msg.value);
    }

    /**
     * Withdraws deposit balance from EntryPoint to target address (owner only).
     */
    function withdrawTo(address payable target, uint256 amount) external onlyOwner {
        ENTRY_POINT.withdrawTo(target, amount);
    }

    /**
     * Returns current deposit balance in EntryPoint.
     */
    function getDeposit() external view returns (uint256) {
        return ENTRY_POINT.balanceOf(address(this));
    }

    /**
     * Validates that the paymaster agrees to sponsor the UserOperation.
     * Enforces that only the canonical EntryPoint can trigger validation.
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        emit GasSponsored(userOpHash, userOp.sender, maxCost);

        // Return sender and userOpHash in context for postOp tracking
        context = abi.encode(userOpHash, userOp.sender);

        // validationData = 0 indicates valid signature with no time-range restrictions (valid indefinitely)
        return (context, 0);
    }

    /**
     * Post-operation handler called by EntryPoint after inner execution.
     * Verified to be called only through the canonical EntryPoint.
     */
    function postOp(
        PostOpMode /* mode */,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 /* actualUserOpFeePerGas */
    ) external override onlyEntryPoint {
        (bytes32 userOpHash, address sender) = abi.decode(context, (bytes32, address));
        emit GasRefunded(userOpHash, sender, actualGasCost);
    }
}
