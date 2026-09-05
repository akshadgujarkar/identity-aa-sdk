// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "account-abstraction/core/Helpers.sol";
import {BaseAccount} from "account-abstraction/core/BaseAccount.sol";
import {SmartAccount} from "../src/SmartAccount.sol";
import {SmartAccountFactory} from "../src/SmartAccountFactory.sol";

contract MockTarget {
    uint256 public count;
    address public lastCaller;
    uint256 public lastValue;

    event Called(address indexed sender, uint256 value, uint256 newCount);

    function increment(uint256 amount) external payable {
        count += amount;
        lastCaller = msg.sender;
        lastValue = msg.value;
        emit Called(msg.sender, msg.value, count);
    }

    function failingMethod() external pure {
        revert("Target: execution failed intentionally");
    }
}

contract SmartAccountTest is Test {
    EntryPoint public entryPoint;
    SmartAccount public account;
    SmartAccountFactory public factory;
    MockTarget public target;

    uint256 internal ownerPrivateKey;
    address internal ownerAddress;

    uint256 internal otherPrivateKey;
    address internal otherAddress;

    function setUp() public {
        entryPoint = new EntryPoint();

        ownerPrivateKey = 0xA11CE;
        ownerAddress = vm.addr(ownerPrivateKey);

        otherPrivateKey = 0xB0B;
        otherAddress = vm.addr(otherPrivateKey);

        account = new SmartAccount(IEntryPoint(address(entryPoint)), ownerAddress);
        factory = new SmartAccountFactory(IEntryPoint(address(entryPoint)));
        target = new MockTarget();

        // Fund account with native currency
        vm.deal(address(account), 10 ether);
    }

    function test_Initialization() public {
        assertEq(address(account.entryPoint()), address(entryPoint));
        assertEq(account.owner(), ownerAddress);

        // Re-initialization must revert
        vm.expectRevert(SmartAccount.AlreadyInitialized.selector);
        account.initialize(otherAddress);
    }

    function test_Initialize_ZeroAddressReverts() public {
        SmartAccount uninitialized = new SmartAccount(IEntryPoint(address(entryPoint)), address(0));
        vm.expectRevert(SmartAccount.InvalidOwner.selector);
        uninitialized.initialize(address(0));
    }

    function test_ValidateUserOp_CallerGating() public {
        PackedUserOperation memory userOp;
        bytes32 userOpHash = keccak256("testUserOp");

        // Calling from non-EntryPoint must revert NotFromEntryPoint
        vm.prank(otherAddress);
        vm.expectRevert();
        account.validateUserOp(userOp, userOpHash, 0);
    }

    function test_ValidateUserOp_ValidSignature() public {
        bytes32 userOpHash = keccak256("testUserOpHash");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, userOpHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        PackedUserOperation memory userOp;
        userOp.sender = address(account);
        userOp.signature = signature;

        vm.prank(address(entryPoint));
        uint256 validationData = account.validateUserOp(userOp, userOpHash, 0);
        assertEq(validationData, SIG_VALIDATION_SUCCESS);
    }

    function test_ValidateUserOp_InvalidSignature_DoesNotRevert() public {
        bytes32 userOpHash = keccak256("testUserOpHash");
        // Sign with a different private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(otherPrivateKey, userOpHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        PackedUserOperation memory userOp;
        userOp.sender = address(account);
        userOp.signature = signature;

        vm.prank(address(entryPoint));
        uint256 validationData = account.validateUserOp(userOp, userOpHash, 0);
        assertEq(validationData, SIG_VALIDATION_FAILED);
    }

    function test_ValidateUserOp_Prefund() public {
        bytes32 userOpHash = keccak256("testPrefundHash");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, userOpHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        PackedUserOperation memory userOp;
        userOp.sender = address(account);
        userOp.signature = signature;

        uint256 missingFunds = 1 ether;
        uint256 epBalanceBefore = address(entryPoint).balance;

        vm.prank(address(entryPoint));
        account.validateUserOp(userOp, userOpHash, missingFunds);

        assertEq(address(entryPoint).balance, epBalanceBefore + missingFunds);
    }

    function test_Execute_SingleCall() public {
        bytes memory callData = abi.encodeWithSelector(MockTarget.increment.selector, 5);

        vm.prank(address(entryPoint));
        account.execute(address(target), 0.5 ether, callData);

        assertEq(target.count(), 5);
        assertEq(target.lastCaller(), address(account));
        assertEq(target.lastValue(), 0.5 ether);
    }

    function test_Execute_RevertsForUnauthorizedCaller() public {
        bytes memory callData = abi.encodeWithSelector(MockTarget.increment.selector, 5);

        vm.prank(otherAddress);
        vm.expectRevert(abi.encodeWithSelector(SmartAccount.NotOwnerOrEntryPoint.selector, otherAddress));
        account.execute(address(target), 0, callData);
    }

    function test_Execute_BubblesUpRevert() public {
        bytes memory callData = abi.encodeWithSelector(MockTarget.failingMethod.selector);

        vm.prank(address(entryPoint));
        vm.expectRevert("Target: execution failed intentionally");
        account.execute(address(target), 0, callData);
    }

    function test_ExecuteBatch() public {
        BaseAccount.Call[] memory calls = new BaseAccount.Call[](2);
        calls[0] = BaseAccount.Call({
            target: address(target),
            value: 0.1 ether,
            data: abi.encodeWithSelector(MockTarget.increment.selector, 3)
        });
        calls[1] = BaseAccount.Call({
            target: address(target),
            value: 0.2 ether,
            data: abi.encodeWithSelector(MockTarget.increment.selector, 7)
        });

        vm.prank(address(entryPoint));
        account.executeBatch(calls);

        assertEq(target.count(), 10);
        assertEq(address(target).balance, 0.3 ether);
    }

    function test_ERC1271_IsValidSignature() public {
        bytes32 hash = keccak256("AppMessageToSign");

        // Valid owner signature
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, hash);
        bytes memory validSig = abi.encodePacked(r, s, v);
        assertEq(account.isValidSignature(hash, validSig), bytes4(0x1626ba7e));

        // Invalid signature
        (uint8 badV, bytes32 badR, bytes32 badS) = vm.sign(otherPrivateKey, hash);
        bytes memory invalidSig = abi.encodePacked(badR, badS, badV);
        assertEq(account.isValidSignature(hash, invalidSig), bytes4(0xffffffff));
    }

    function test_DepositAndWithdraw() public {
        // Deposit 1 ether into EntryPoint
        account.addDeposit{value: 1 ether}();
        assertEq(account.getDeposit(), 1 ether);

        // Withdraw 0.5 ether to otherAddress
        uint256 otherBalanceBefore = otherAddress.balance;
        vm.prank(ownerAddress);
        account.withdrawDepositTo(payable(otherAddress), 0.5 ether);

        assertEq(otherAddress.balance, otherBalanceBefore + 0.5 ether);
        assertEq(account.getDeposit(), 0.5 ether);
    }
}
