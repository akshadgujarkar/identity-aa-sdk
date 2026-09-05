// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SmartAccount} from "../src/SmartAccount.sol";
import {SmartAccountFactory} from "../src/SmartAccountFactory.sol";
import {Paymaster} from "../src/Paymaster.sol";

contract ScaffoldTest is Test {
    address constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address owner = address(0xABCD);

    function test_smartAccountDeployment() public {
        SmartAccount account = new SmartAccount(ENTRY_POINT, owner);
        assertEq(account.entryPoint(), ENTRY_POINT);
        assertEq(account.owner(), owner);
    }

    function test_smartAccountFactoryDeployment() public {
        SmartAccountFactory factory = new SmartAccountFactory(ENTRY_POINT);
        bytes32 salt = bytes32(uint256(1));
        address predicted = factory.getAddress(owner, salt);
        SmartAccount account = factory.createAccount(owner, salt);
        assertEq(address(account), predicted);
    }

    function test_paymasterDeployment() public {
        Paymaster paymaster = new Paymaster(ENTRY_POINT, owner);
        assertEq(paymaster.entryPoint(), ENTRY_POINT);
        assertEq(paymaster.owner(), owner);
    }
}
