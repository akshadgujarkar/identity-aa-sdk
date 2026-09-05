// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SmartAccountFactory} from "../src/SmartAccountFactory.sol";
import {Paymaster} from "../src/Paymaster.sol";

contract DeployScaffold is Script {
    address constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external {
        vm.startBroadcast();
        SmartAccountFactory factory = new SmartAccountFactory(ENTRY_POINT);
        Paymaster paymaster = new Paymaster(ENTRY_POINT, msg.sender);
        vm.stopBroadcast();

        console.log("SmartAccountFactory deployed to:", address(factory));
        console.log("Paymaster deployed to:", address(paymaster));
    }
}
