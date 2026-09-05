// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {IPaymaster} from "account-abstraction/interfaces/IPaymaster.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {Paymaster} from "../src/Paymaster.sol";

contract PaymasterTest is Test {
    EntryPoint public entryPoint;
    Paymaster public paymaster;

    address internal owner = address(0xAA11);
    address internal unauthorized = address(0xBAD);

    function setUp() public {
        entryPoint = new EntryPoint();
        paymaster = new Paymaster(IEntryPoint(address(entryPoint)), owner);
        vm.deal(owner, 10 ether);
        vm.deal(address(this), 10 ether);
    }

    function testDepositAndBalance() public {
        vm.prank(owner);
        paymaster.deposit{value: 2 ether}();

        assertEq(paymaster.getDeposit(), 2 ether);
        assertEq(entryPoint.balanceOf(address(paymaster)), 2 ether);
    }

    function testWithdrawToByOwner() public {
        vm.prank(owner);
        paymaster.deposit{value: 3 ether}();

        address payable recipient = payable(address(0x1234));
        vm.prank(owner);
        paymaster.withdrawTo(recipient, 1 ether);

        assertEq(paymaster.getDeposit(), 2 ether);
        assertEq(recipient.balance, 1 ether);
    }

    function testWithdrawToFailsForNonOwner() public {
        vm.prank(owner);
        paymaster.deposit{value: 2 ether}();

        vm.prank(unauthorized);
        vm.expectRevert(Paymaster.OnlyOwner.selector);
        paymaster.withdrawTo(payable(unauthorized), 1 ether);
    }

    function testValidatePaymasterUserOpRejectsUnauthorizedCaller() public {
        PackedUserOperation memory userOp;
        userOp.sender = address(0x999);

        vm.prank(unauthorized);
        vm.expectRevert(Paymaster.OnlyEntryPoint.selector);
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), 10000);
    }

    function testValidatePaymasterUserOpSucceedsFromEntryPoint() public {
        PackedUserOperation memory userOp;
        userOp.sender = address(0x999);

        vm.prank(address(entryPoint));
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(
            userOp,
            bytes32(uint256(1)),
            50000
        );

        assertEq(validationData, 0);
        assertGt(context.length, 0);
    }

    function testPostOpRejectsUnauthorizedCaller() public {
        vm.prank(unauthorized);
        vm.expectRevert(Paymaster.OnlyEntryPoint.selector);
        paymaster.postOp(IPaymaster.PostOpMode.opSucceeded, "", 1000, 10);
    }

    function testPostOpSucceedsFromEntryPoint() public {
        bytes memory context = abi.encode(bytes32(uint256(1)), address(0x999));
        vm.prank(address(entryPoint));
        paymaster.postOp(IPaymaster.PostOpMode.opSucceeded, context, 1000, 10);
    }
}
