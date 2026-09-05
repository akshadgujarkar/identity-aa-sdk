// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {SmartAccount} from "../src/SmartAccount.sol";
import {SmartAccountFactory} from "../src/SmartAccountFactory.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract MockTarget {
    uint256 public count;
    address public lastCaller;
    uint256 public lastValue;

    function increment(uint256 amount) external payable {
        count += amount;
        lastCaller = msg.sender;
        lastValue = msg.value;
    }
}

contract SmartAccountFactoryTest is Test {
    using MessageHashUtils for bytes32;

    EntryPoint public entryPoint;
    SmartAccountFactory public factory;
    MockTarget public target;

    uint256 internal ownerPrivateKey;
    address internal ownerAddress;

    uint256 internal otherPrivateKey;
    address internal otherAddress;

    address payable internal beneficiary;

    function setUp() public {
        entryPoint = new EntryPoint();
        factory = new SmartAccountFactory(IEntryPoint(address(entryPoint)));
        target = new MockTarget();

        ownerPrivateKey = 0xA11CE;
        ownerAddress = vm.addr(ownerPrivateKey);

        otherPrivateKey = 0xB0B;
        otherAddress = vm.addr(otherPrivateKey);

        beneficiary = payable(address(0xDEAD));
    }

    function test_CounterfactualAddressMatchesDeployed() public {
        bytes32 salt = bytes32(uint256(12345));

        // 1. Compute counterfactual address via pure view call
        address predicted = factory.getAddress(ownerAddress, salt);
        assertEq(predicted.code.length, 0);

        // 2. Deploy account
        SmartAccount account = factory.createAccount(ownerAddress, salt);
        assertEq(address(account), predicted);
        assertGt(predicted.code.length, 0);
        assertEq(account.owner(), ownerAddress);
        assertEq(address(account.entryPoint()), address(entryPoint));
    }

    function test_Idempotency() public {
        bytes32 salt = bytes32(uint256(999));

        SmartAccount account1 = factory.createAccount(ownerAddress, salt);
        assertGt(address(account1).code.length, 0);

        // Subsequent call returns the exact same address without reverting
        SmartAccount account2 = factory.createAccount(ownerAddress, salt);
        assertEq(address(account1), address(account2));
    }

    function test_DistinctSaltAndOwnerProduceDistinctAddresses() public {
        bytes32 salt1 = bytes32(uint256(1));
        bytes32 salt2 = bytes32(uint256(2));

        address addr1 = factory.getAddress(ownerAddress, salt1);
        address addr2 = factory.getAddress(ownerAddress, salt2);
        address addr3 = factory.getAddress(otherAddress, salt1);

        assertTrue(addr1 != addr2, "Different salts must produce distinct addresses");
        assertTrue(addr1 != addr3, "Different owners must produce distinct addresses");
        assertTrue(addr2 != addr3, "Different (owner, salt) pairs must produce distinct addresses");
    }

    function test_FirstUserOpDeploymentViaEntryPoint() public {
        bytes32 salt = bytes32(uint256(42));
        address counterfactualAccount = factory.getAddress(ownerAddress, salt);

        assertEq(counterfactualAccount.code.length, 0);
        vm.deal(counterfactualAccount, 5 ether);

        PackedUserOperation memory userOp;
        userOp.sender = counterfactualAccount;
        userOp.nonce = 0;
        userOp.initCode = abi.encodePacked(
            address(factory),
            abi.encodeWithSelector(factory.createAccount.selector, ownerAddress, salt)
        );
        userOp.callData = abi.encodeWithSignature(
            "execute(address,uint256,bytes)",
            address(target),
            0.5 ether,
            abi.encodeWithSelector(MockTarget.increment.selector, 7)
        );
        userOp.accountGasLimits = bytes32((uint256(1_500_000) << 128) | uint256(500_000));
        userOp.preVerificationGas = 100000;
        userOp.gasFees = bytes32((uint256(1 gwei) << 128) | uint256(2 gwei));

        bytes32 userOpHash = entryPoint.getUserOpHash(userOp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, userOpHash.toEthSignedMessageHash());
        userOp.signature = abi.encodePacked(r, s, v);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        // Execute first UserOperation via EntryPoint using an EOA bundler
        address bundler = address(0x9999);
        vm.deal(bundler, 1 ether);
        vm.prank(bundler, bundler);
        entryPoint.handleOps(ops, beneficiary);

        assertGt(counterfactualAccount.code.length, 0);
        assertEq(SmartAccount(payable(counterfactualAccount)).owner(), ownerAddress);
        assertEq(target.count(), 7);
        assertEq(target.lastCaller(), counterfactualAccount);
        assertEq(target.lastValue(), 0.5 ether);
    }
}
