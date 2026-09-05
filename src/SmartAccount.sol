// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseAccount} from "account-abstraction/core/BaseAccount.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "account-abstraction/core/Helpers.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/**
 * @title SmartAccount
 * @notice Single-owner ERC-4337 Smart Account contract built on official account-abstraction standard.
 * Specifications defined in docs/SMART_ACCOUNT.md.
 */
contract SmartAccount is BaseAccount, IERC1271 {
    using MessageHashUtils for bytes32;

    // ERC-1271 magic values
    bytes4 internal constant MAGICVALUE = 0x1626ba7e;
    bytes4 internal constant INVALID_SIGNATURE = 0xffffffff;

    // Immutable EntryPoint reference per chain
    IEntryPoint private immutable _entryPoint;

    // Storage slot 0: single owner address (isolated for future recovery-roadmap compatibility)
    address public owner;
    bool private _initialized;

    event SmartAccountInitialized(IEntryPoint indexed entryPoint, address indexed owner);

    error AlreadyInitialized();
    error InvalidOwner();
    error NotOwnerOrEntryPoint(address caller);

    modifier onlyEntryPointOrOwner() {
        _requireForExecute();
        _;
    }

    /**
     * @param anEntryPoint The canonical EntryPoint contract for this chain.
     * @param initialOwner Optional initial owner. If address(0), requires initialize(owner).
     */
    constructor(IEntryPoint anEntryPoint, address initialOwner) {
        _entryPoint = anEntryPoint;
        if (initialOwner != address(0)) {
            owner = initialOwner;
            _initialized = true;
            emit SmartAccountInitialized(anEntryPoint, initialOwner);
        }
    }

    /**
     * @notice Initializes the smart account with a single owner.
     * @param anOwner The owner address controlling this account.
     */
    function initialize(address anOwner) external {
        if (_initialized) {
            revert AlreadyInitialized();
        }
        if (anOwner == address(0)) {
            revert InvalidOwner();
        }
        owner = anOwner;
        _initialized = true;
        emit SmartAccountInitialized(_entryPoint, anOwner);
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    /**
     * @dev Gating for execution: EntryPoint, owner, or account self-calls.
     */
    function _requireForExecute() internal view override {
        if (msg.sender != address(_entryPoint) && msg.sender != owner && msg.sender != address(this)) {
            revert NotOwnerOrEntryPoint(msg.sender);
        }
    }

    /**
     * @dev Validates ECDSA signature over userOpHash.
     * MUST return SIG_VALIDATION_FAILED (1) on mismatch without reverting.
     */
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        bytes32 ethSignedMessageHash = userOpHash.toEthSignedMessageHash();
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(ethSignedMessageHash, userOp.signature);

        if (err != ECDSA.RecoverError.NoError || recovered != owner) {
            // Also attempt direct recovery over userOpHash
            (address rawRecovered, ECDSA.RecoverError rawErr, ) = ECDSA.tryRecover(userOpHash, userOp.signature);
            if (rawErr != ECDSA.RecoverError.NoError || rawRecovered != owner) {
                return SIG_VALIDATION_FAILED;
            }
        }

        return SIG_VALIDATION_SUCCESS;
    }

    /**
     * @notice ERC-1271 standard verification for off-chain signatures.
     * @param hash The digest signed by the account's owner.
     * @param signature Signature bytes.
     */
    function isValidSignature(bytes32 hash, bytes calldata signature) external view override returns (bytes4) {
        bytes32 ethSignedMessageHash = hash.toEthSignedMessageHash();
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(ethSignedMessageHash, signature);

        if (err == ECDSA.RecoverError.NoError && recovered == owner) {
            return MAGICVALUE;
        }

        (address rawRecovered, ECDSA.RecoverError rawErr, ) = ECDSA.tryRecover(hash, signature);
        if (rawErr == ECDSA.RecoverError.NoError && rawRecovered == owner) {
            return MAGICVALUE;
        }

        return INVALID_SIGNATURE;
    }

    /**
     * @notice Check current deposit for this account in the EntryPoint.
     */
    function getDeposit() external view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    /**
     * @notice Deposit funds for this account in the EntryPoint.
     */
    function addDeposit() external payable {
        entryPoint().depositTo{value: msg.value}(address(this));
    }

    /**
     * @notice Withdraw funds from EntryPoint deposit to target address.
     */
    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) external onlyEntryPointOrOwner {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    // Allow account to receive native currency
    receive() external payable {}
}
