// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {IPaymaster} from "account-abstraction/interfaces/IPaymaster.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "account-abstraction/core/Helpers.sol";
import {BaseAccount} from "account-abstraction/core/BaseAccount.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SmartAccount} from "../src/SmartAccount.sol";
import {SmartAccountFactory} from "../src/SmartAccountFactory.sol";
import {Paymaster} from "../src/Paymaster.sol";

/**
 * @title SecurityHardeningTest
 * @notice Tests threat model mitigations and security invariants specified in docs/SECURITY.md.
 */
contract SecurityHardeningTest is Test {
    using MessageHashUtils for bytes32;

    EntryPoint public entryPoint;
    SmartAccount public account;
    SmartAccountFactory public factory;
    Paymaster public paymaster;

    uint256 internal ownerPk = 0xA11CE;
    address internal ownerAddr;

    uint256 internal attackerPk = 0xBADB0B;
    address internal attackerAddr;

    bytes4 internal constant ERC1271_MAGICVALUE = 0x1626ba7e;
    bytes4 internal constant ERC1271_INVALID = 0xffffffff;

    function setUp() public {
        entryPoint = new EntryPoint();
        ownerAddr = vm.addr(ownerPk);
        attackerAddr = vm.addr(attackerPk);

        account = new SmartAccount(IEntryPoint(address(entryPoint)), ownerAddr);
        factory = new SmartAccountFactory(IEntryPoint(address(entryPoint)));
        paymaster = new Paymaster(IEntryPoint(address(entryPoint)), ownerAddr);

        vm.deal(address(account), 10 ether);
        vm.deal(ownerAddr, 10 ether);
        vm.deal(attackerAddr, 10 ether);
    }

    /* -------------------------------------------------------------------------- */
    /*  Threat 1: Initialization attacks (re-initialization / takeover)           */
    /* -------------------------------------------------------------------------- */

    function test_Security_ReinitializationReverts() public {
        // Account constructed with owner is already initialized
        vm.prank(attackerAddr);
        vm.expectRevert(SmartAccount.AlreadyInitialized.selector);
        account.initialize(attackerAddr);

        // Owner remains original owner
        assertEq(account.owner(), ownerAddr);
    }

    function test_Security_InitializeZeroAddressReverts() public {
        // Uninitialized account rejects zero address owner
        SmartAccount freshAccount = new SmartAccount(IEntryPoint(address(entryPoint)), address(0));
        vm.expectRevert(SmartAccount.InvalidOwner.selector);
        freshAccount.initialize(address(0));
    }

    /* -------------------------------------------------------------------------- */
    /*  Threat 2: Unauthorized caller execution gating (Direct Calls)              */
    /* -------------------------------------------------------------------------- */

    function test_Security_ExecuteRejectsUnauthorizedCaller() public {
        vm.prank(attackerAddr);
        vm.expectRevert(abi.encodeWithSelector(SmartAccount.NotOwnerOrEntryPoint.selector, attackerAddr));
        account.execute(address(0x1234), 0, "");
    }

    function test_Security_ExecuteBatchRejectsUnauthorizedCaller() public {
        BaseAccount.Call[] memory calls = new BaseAccount.Call[](1);
        calls[0] = BaseAccount.Call({
            target: address(0x1234),
            value: 0,
            data: ""
        });

        vm.prank(attackerAddr);
        vm.expectRevert(abi.encodeWithSelector(SmartAccount.NotOwnerOrEntryPoint.selector, attackerAddr));
        account.executeBatch(calls);
    }

    /* -------------------------------------------------------------------------- */
    /*  Threat 3: Signature tampering & validateUserOp Invariants                  */
    /* -------------------------------------------------------------------------- */

    function test_Security_ValidateUserOpRejectsNonEntryPointCaller() public {
        PackedUserOperation memory userOp;
        userOp.sender = address(account);

        vm.prank(attackerAddr);
        vm.expectRevert();
        account.validateUserOp(userOp, bytes32(0), 0);
    }

    function test_Security_ValidateUserOpReturnsSigFailedForForgedSignature() public {
        bytes32 userOpHash = keccak256("userOpHash_security_test");

        // Attacker signs instead of owner
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attackerPk, userOpHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        PackedUserOperation memory userOp;
        userOp.sender = address(account);
        userOp.nonce = 0;
        userOp.signature = signature;

        // EntryPoint validates
        vm.prank(address(entryPoint));
        uint256 validationData = account.validateUserOp(userOp, userOpHash, 0);

        // Must return SIG_VALIDATION_FAILED (1) without reverting
        assertEq(validationData, SIG_VALIDATION_FAILED);
    }

    function test_Security_ValidateUserOpSucceedsForValidOwnerSignature() public {
        bytes32 userOpHash = keccak256("userOpHash_valid_test");

        // Owner signs
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, userOpHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        PackedUserOperation memory userOp;
        userOp.sender = address(account);
        userOp.nonce = 0;
        userOp.signature = signature;

        vm.prank(address(entryPoint));
        uint256 validationData = account.validateUserOp(userOp, userOpHash, 0);

        // Must return SIG_VALIDATION_SUCCESS (0)
        assertEq(validationData, SIG_VALIDATION_SUCCESS);
    }

    /* -------------------------------------------------------------------------- */
    /*  Threat 4: ERC-1271 Signature Validation                                   */
    /* -------------------------------------------------------------------------- */

    function test_Security_ERC1271_ValidOwnerReturnsMagicValue() public view {
        bytes32 hash = keccak256("eip1271_hash");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, hash);
        bytes memory signature = abi.encodePacked(r, s, v);

        bytes4 result = account.isValidSignature(hash, signature);
        assertEq(result, ERC1271_MAGICVALUE);
    }

    function test_Security_ERC1271_AttackerSignatureReturnsInvalid() public view {
        bytes32 hash = keccak256("eip1271_hash");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attackerPk, hash);
        bytes memory signature = abi.encodePacked(r, s, v);

        bytes4 result = account.isValidSignature(hash, signature);
        assertEq(result, ERC1271_INVALID);
    }

    /* -------------------------------------------------------------------------- */
    /*  Threat 5: Paymaster Caller Gating & Fund Security                         */
    /* -------------------------------------------------------------------------- */

    function test_Security_PaymasterValidateRejectsNonEntryPoint() public {
        PackedUserOperation memory userOp;
        userOp.sender = address(account);

        vm.prank(attackerAddr);
        vm.expectRevert(Paymaster.OnlyEntryPoint.selector);
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), 10000);
    }

    function test_Security_PaymasterPostOpRejectsNonEntryPoint() public {
        vm.prank(attackerAddr);
        vm.expectRevert(Paymaster.OnlyEntryPoint.selector);
        paymaster.postOp(IPaymaster.PostOpMode.opSucceeded, "", 10000, 1000);
    }

    function test_Security_PaymasterWithdrawRejectsAttacker() public {
        vm.prank(ownerAddr);
        paymaster.deposit{value: 2 ether}();

        vm.prank(attackerAddr);
        vm.expectRevert(Paymaster.OnlyOwner.selector);
        paymaster.withdrawTo(payable(attackerAddr), 1 ether);
    }

    /* -------------------------------------------------------------------------- */
    /*  Threat 6: Factory Salt & Determinism Invariants                           */
    /* -------------------------------------------------------------------------- */

    function test_Security_FactoryDeterminismAndSaltIsolation() public {
        bytes32 salt1 = bytes32(uint256(1));
        bytes32 salt2 = bytes32(uint256(2));

        address addrOwnerSalt1 = factory.getAddress(ownerAddr, salt1);
        address addrOwnerSalt2 = factory.getAddress(ownerAddr, salt2);
        address addrAttackerSalt1 = factory.getAddress(attackerAddr, salt1);

        // Different salts produce distinct addresses
        assertTrue(addrOwnerSalt1 != addrOwnerSalt2);
        // Different owners produce distinct addresses
        assertTrue(addrOwnerSalt1 != addrAttackerSalt1);

        // Deployed address matches computed counterfactual address exactly
        address deployed = address(factory.createAccount(ownerAddr, salt1));
        assertEq(deployed, addrOwnerSalt1);

        // Idempotency: re-calling createAccount does not overwrite or fail
        address reDeployed = address(factory.createAccount(ownerAddr, salt1));
        assertEq(reDeployed, addrOwnerSalt1);
    }
}
