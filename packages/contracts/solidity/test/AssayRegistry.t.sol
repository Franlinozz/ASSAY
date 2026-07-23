// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AssayRegistry} from "../src/AssayRegistry.sol";

// Minimal cheatcode interface — avoids a forge-std submodule.
interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract AssayRegistryTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    AssayRegistry reg;
    address sealer = address(0xBEEF);

    function setUp() public {
        reg = new AssayRegistry(sealer);
    }

    function test_OnlySealerCanSeal() public {
        bytes32[] memory leaves = new bytes32[](1);
        leaves[0] = keccak256("a");
        vm.prank(address(0xDEAD));
        vm.expectRevert(AssayRegistry.NotSealer.selector);
        reg.sealBatch(leaves);
    }

    function test_SealAndRead() public {
        bytes32[] memory leaves = new bytes32[](1);
        leaves[0] = keccak256("a");
        vm.prank(sealer);
        reg.sealBatch(leaves);
        require(reg.anchoredAt(leaves[0]) == block.timestamp, "not anchored");
    }

    function test_IdempotentReseal() public {
        bytes32[] memory leaves = new bytes32[](1);
        leaves[0] = keccak256("a");
        vm.prank(sealer);
        reg.sealBatch(leaves);
        uint256 first = reg.anchoredAt(leaves[0]);
        vm.warp(block.timestamp + 1000);
        vm.prank(sealer);
        reg.sealBatch(leaves);
        require(reg.anchoredAt(leaves[0]) == first, "timestamp changed on reseal");
    }

    function test_BatchOf50IsGasSane() public {
        bytes32[] memory leaves = new bytes32[](50);
        for (uint256 i = 0; i < 50; i++) leaves[i] = keccak256(abi.encode(i));
        vm.prank(sealer);
        uint256 g = gasleft();
        reg.sealBatch(leaves);
        require(g - gasleft() < 2_500_000, "batch of 50 too expensive");
    }
}
