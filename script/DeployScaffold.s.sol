// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {SmartAccountFactory} from "../src/SmartAccountFactory.sol";
import {Paymaster} from "../src/Paymaster.sol";

contract DeployScaffold is Script {
    address constant CANONICAL_ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external {
        vm.startBroadcast();

        // 1. Deploy EntryPoint (or reuse if canonical already has bytecode)
        address entryPointAddr;
        if (CANONICAL_ENTRY_POINT.code.length > 0) {
            entryPointAddr = CANONICAL_ENTRY_POINT;
        } else {
            EntryPoint ep = new EntryPoint();
            entryPointAddr = address(ep);
        }

        // 2. Deploy SmartAccountFactory pointing to EntryPoint
        SmartAccountFactory factory = new SmartAccountFactory(IEntryPoint(entryPointAddr));

        // 3. Deploy Paymaster
        Paymaster paymaster = new Paymaster(IEntryPoint(entryPointAddr), msg.sender);

        // 4. Fund Paymaster with 2 ETH deposit in EntryPoint for gas sponsorship
        IEntryPoint(entryPointAddr).depositTo{value: 2 ether}(address(paymaster));

        vm.stopBroadcast();

        console.log("==================================================");
        console.log("EntryPoint deployed to:          ", entryPointAddr);
        console.log("SmartAccountFactory deployed to: ", address(factory));
        console.log("Paymaster deployed to:           ", address(paymaster));
        console.log("Paymaster funded with 2 ETH deposit in EntryPoint!");
        console.log("==================================================");
    }
}
