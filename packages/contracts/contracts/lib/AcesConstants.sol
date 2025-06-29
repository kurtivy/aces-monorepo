// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AcesConstants
 * @author ACES
 * @dev Library containing constants and error definitions used across ACES contracts
 */
library AcesConstants {
    // --- Custom Errors for Gas Efficiency ---
    error ZeroAddress();
    error ZeroAmount();
    error InvalidTokenId();
    error ExceedsMaxSupply();
    error InsufficientPayment(uint256 required, uint256 provided);
    error OutputAmountTooLow(uint256 expected, uint256 actual);
    error NotDeedOwner(uint256 deedId, address caller);
    error DeploymentFailed();
    error InitializationFailed();
    error InvalidClaimTokenEndTime();
    error InvalidClaimTokenVestingSchedule();
    error NoFeesToClaim();

    // --- Constants ---
    uint256 public constant PLATFORM_FEE_BPS = 50; // 0.5%
    uint256 public constant OWNER_FEE_BPS = 50; // 0.5%
    uint256 public constant CURVE_BASE_PRICE = 100; // 100 ACES
    uint256 public constant CURVE_MULTIPLIER = 10; // Price increases by 10 ACES per sqrt(supply)
    uint256 public constant PRICE_SCALE = 1; // No additional scaling needed

    // --- Errors ---
    error InvalidAmount();
    error EmergencyStopActive();
    error NotFactory();
    error NotPendingFactory();
    error NotEnoughBalance();
    error TransferFailed();
    error InvalidAddress();
    error InvalidPrice();
    error InvalidFee();
    error InvalidRole();
    error Unauthorized();
    error ContractPaused();
    error AlreadyInitialized();
    error InvalidSignature();
    error ExpiredDeadline();
    error InvalidNonce();
    error InvalidTokenURI();
    error InvalidMetadata();
    error InvalidRoyalty();
    error InvalidBeneficiary();
    error InvalidDuration();
    error InvalidStartTime();
    error InvalidEndTime();
    error InvalidVestingSchedule();
    error InvalidClaimAmount();
    error InvalidClaimTime();
    error InvalidClaimPeriod();
    error InvalidClaimBeneficiary();
    error InvalidClaimSignature();
    error InvalidClaimNonce();
    error InvalidClaimTokenId();
    error InvalidClaimTokenAmount();
    error InvalidClaimTokenPrice();
    error InvalidClaimTokenFee();
    error InvalidClaimTokenRoyalty();
    error InvalidClaimTokenBeneficiary();
    error InvalidClaimTokenMetadata();
    error InvalidClaimTokenURI();
    error InvalidClaimTokenDuration();
    error InvalidClaimTokenStartTime();
}