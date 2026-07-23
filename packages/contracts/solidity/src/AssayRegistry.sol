// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AssayRegistry
/// @notice Anchors salted commitment leaves for Assay dossiers. Stores ONLY leaf → timestamp;
///         zero personal data by construction (guardrail #3). A leaf is keccak256(manifestHash || salt),
///         computed off-chain; the salt never touches this contract.
contract AssayRegistry {
    /// @notice The only address permitted to anchor leaves.
    address public immutable sealer;

    /// @notice leaf => block timestamp it was first anchored at (0 = not anchored).
    mapping(bytes32 => uint256) public anchoredAt;

    event Sealed(bytes32 indexed leaf, uint256 timestamp);

    error NotSealer();

    constructor(address _sealer) {
        sealer = _sealer;
    }

    modifier onlySealer() {
        if (msg.sender != sealer) revert NotSealer();
        _;
    }

    /// @notice Anchor a batch of commitment leaves. Idempotent: an already-anchored leaf keeps its
    ///         original timestamp and is not re-emitted.
    function sealBatch(bytes32[] calldata leaves) external onlySealer {
        for (uint256 i = 0; i < leaves.length; i++) {
            bytes32 leaf = leaves[i];
            if (anchoredAt[leaf] == 0) {
                anchoredAt[leaf] = block.timestamp;
                emit Sealed(leaf, block.timestamp);
            }
        }
    }
}
