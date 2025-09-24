/// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@fortefoundation/forte-rules-engine/src/client/RulesEngineForeignCallAdmin.sol";

contract PermissionedForeignCall is RulesEngineForeignCallAdmin {
    function isActive(uint256 _input) public pure returns (uint256) {
        return _input;
    }
}