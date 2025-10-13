"use strict";
// Auto-generated file - DO NOT EDIT
// Generated from compiled contract artifacts
// Run 'pnpm extract-abis' to regenerate
Object.defineProperty(exports, "__esModule", { value: true });
exports.ABIS = exports.ACES_FACTORY_ABI = exports.ERC20_ABI = exports.ACES_SWAP_ABI = exports.ACES_VAULT_ABI = void 0;
// Legacy ABIs (needed for backend)
exports.ACES_VAULT_ABI = [
    {
        type: 'constructor',
        inputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'IS_TEST',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'bool',
                internalType: 'bool',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'UPGRADE_INTERFACE_VERSION',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'string',
                internalType: 'string',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'buyShares',
        inputs: [
            {
                name: 'sharesSubject',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'createRoom',
        inputs: [
            {
                name: 'curve',
                type: 'uint8',
                internalType: 'enum AcesVault.Curves',
            },
            {
                name: 'steepness',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'floor',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'maxPrice',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'midPoint',
                type: 'int256',
                internalType: 'int256',
            },
            {
                name: 'lockupPeriod',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'room',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'excludeArtifacts',
        inputs: [],
        outputs: [
            {
                name: 'excludedArtifacts_',
                type: 'string[]',
                internalType: 'string[]',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'excludeContracts',
        inputs: [],
        outputs: [
            {
                name: 'excludedContracts_',
                type: 'address[]',
                internalType: 'address[]',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'excludeSenders',
        inputs: [],
        outputs: [
            {
                name: 'excludedSenders_',
                type: 'address[]',
                internalType: 'address[]',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'failed',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'bool',
                internalType: 'bool',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getBuyPrice',
        inputs: [
            {
                name: 'sharesSubject',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'price',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getBuyPriceAfterFee',
        inputs: [
            {
                name: 'sharesSubject',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'price',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getPrice',
        inputs: [
            {
                name: 'sharesSubject',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'isBuy',
                type: 'bool',
                internalType: 'bool',
            },
        ],
        outputs: [
            {
                name: 'price',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getPriceLinear',
        inputs: [
            {
                name: 'supply',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'steepness',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'floor',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'price',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'pure',
    },
    {
        type: 'function',
        name: 'getPriceQuadratic',
        inputs: [
            {
                name: 'supply',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'steepness',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'floor',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'price',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'pure',
    },
    {
        type: 'function',
        name: 'getPriceSigmoid',
        inputs: [
            {
                name: 'supply',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'steepness',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'floor',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'maxPrice',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'midPoint',
                type: 'int256',
                internalType: 'int256',
            },
        ],
        outputs: [
            {
                name: 'price',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'pure',
    },
    {
        type: 'function',
        name: 'getRoomsLength',
        inputs: [
            {
                name: 'sharesSubject',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getSellPrice',
        inputs: [
            {
                name: 'sharesSubject',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'price',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getSellPriceAfterFee',
        inputs: [
            {
                name: 'sharesSubject',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'price',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getTokenBalance',
        inputs: [
            {
                name: 'sharesSubject',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'holder',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getTokenSupply',
        inputs: [
            {
                name: 'sharesSubject',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'initialize',
        inputs: [
            {
                name: 'initialOwner',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'owner',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'protocolFeeDestination',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'protocolFeePercent',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'proxiableUUID',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'bytes32',
                internalType: 'bytes32',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'renounceOwnership',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'rooms',
        inputs: [
            {
                name: 'subject',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'curve',
                type: 'uint8',
                internalType: 'enum AcesVault.Curves',
            },
            {
                name: 'floor',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'midPoint',
                type: 'int256',
                internalType: 'int256',
            },
            {
                name: 'maxPrice',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'steepness',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'sharesSupply',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'lockupPeriod',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'creationTime',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'setFeeDestination',
        inputs: [
            {
                name: 'feeDestination',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'setProtocolFeePercent',
        inputs: [
            {
                name: 'feePercent',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'setSubjectFeePercent',
        inputs: [
            {
                name: 'feePercent',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'setTokenAddress',
        inputs: [
            {
                name: 'newToken',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'subjectFeePercent',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'targetArtifacts',
        inputs: [],
        outputs: [
            {
                name: 'targetedArtifacts_',
                type: 'string[]',
                internalType: 'string[]',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'targetContracts',
        inputs: [],
        outputs: [
            {
                name: 'targetedContracts_',
                type: 'address[]',
                internalType: 'address[]',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'targetSenders',
        inputs: [],
        outputs: [
            {
                name: 'targetedSenders_',
                type: 'address[]',
                internalType: 'address[]',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'token',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'contract IERC20',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'transferOwnership',
        inputs: [
            {
                name: 'newOwner',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'upgradeToAndCall',
        inputs: [
            {
                name: 'newImplementation',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'data',
                type: 'bytes',
                internalType: 'bytes',
            },
        ],
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'withdrawETH',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'event',
        name: 'CreatedRoom',
        inputs: [
            {
                name: 'subject',
                type: 'address',
                indexed: false,
                internalType: 'address',
            },
            {
                name: 'curve',
                type: 'uint8',
                indexed: false,
                internalType: 'uint8',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'steepness',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'floor',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'maxPrice',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'midPoint',
                type: 'int256',
                indexed: false,
                internalType: 'int256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'FeeDestinationChanged',
        inputs: [
            {
                name: 'newDestination',
                type: 'address',
                indexed: false,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'Initialized',
        inputs: [
            {
                name: 'version',
                type: 'uint64',
                indexed: false,
                internalType: 'uint64',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'OwnershipTransferred',
        inputs: [
            {
                name: 'previousOwner',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'newOwner',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'ProtocolFeePercentChanged',
        inputs: [
            {
                name: 'newPercent',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'SellApprovalChanged',
        inputs: [
            {
                name: 'seller',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'operator',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'approved',
                type: 'bool',
                indexed: false,
                internalType: 'bool',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'SubjectFeePercentChanged',
        inputs: [
            {
                name: 'newPercent',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'Trade',
        inputs: [
            {
                name: 'trader',
                type: 'address',
                indexed: false,
                internalType: 'address',
            },
            {
                name: 'subject',
                type: 'address',
                indexed: false,
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'isBuy',
                type: 'bool',
                indexed: false,
                internalType: 'bool',
            },
            {
                name: 'shareAmount',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'ethAmount',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'protocolEthAmount',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'subjectEthAmount',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'supply',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'Transfer',
        inputs: [
            {
                name: 'from',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'to',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'value',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'Upgraded',
        inputs: [
            {
                name: 'implementation',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'error',
        name: 'AddressEmptyCode',
        inputs: [
            {
                name: 'target',
                type: 'address',
                internalType: 'address',
            },
        ],
    },
    {
        type: 'error',
        name: 'ERC1967InvalidImplementation',
        inputs: [
            {
                name: 'implementation',
                type: 'address',
                internalType: 'address',
            },
        ],
    },
    {
        type: 'error',
        name: 'ERC1967NonPayable',
        inputs: [],
    },
    {
        type: 'error',
        name: 'FailedCall',
        inputs: [],
    },
    {
        type: 'error',
        name: 'InvalidInitialization',
        inputs: [],
    },
    {
        type: 'error',
        name: 'NotInitializing',
        inputs: [],
    },
    {
        type: 'error',
        name: 'OwnableInvalidOwner',
        inputs: [
            {
                name: 'owner',
                type: 'address',
                internalType: 'address',
            },
        ],
    },
    {
        type: 'error',
        name: 'OwnableUnauthorizedAccount',
        inputs: [
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
        ],
    },
    {
        type: 'error',
        name: 'UUPSUnauthorizedCallContext',
        inputs: [],
    },
    {
        type: 'error',
        name: 'UUPSUnsupportedProxiableUUID',
        inputs: [
            {
                name: 'slot',
                type: 'bytes32',
                internalType: 'bytes32',
            },
        ],
    },
];
// AcesSwap ABI - for USDC/USDT swapping functionality
exports.ACES_SWAP_ABI = [
    {
        type: 'constructor',
        inputs: [
            {
                name: '_acesCurvesAddress',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'sellUSDCAndBuyCurve',
        inputs: [
            {
                name: 'amountIn',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amountOutMin',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'roomOwner',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'success',
                type: 'bool',
                internalType: 'bool',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'sellUSDTAndBuyCurve',
        inputs: [
            {
                name: 'amountIn',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amountOutMin',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'roomOwner',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'roomNumber',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: 'success',
                type: 'bool',
                internalType: 'bool',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getCurvesAddress',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'pause',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'unpause',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
];
// ERC20 ABI - for USDC/USDT approvals
exports.ERC20_ABI = [
    {
        type: 'function',
        name: 'approve',
        inputs: [
            {
                name: 'spender',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'bool',
                internalType: 'bool',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'allowance',
        inputs: [
            {
                name: 'owner',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'spender',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'balanceOf',
        inputs: [
            {
                name: 'account',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'decimals',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint8',
                internalType: 'uint8',
            },
        ],
        stateMutability: 'view',
    },
];
// AcesFactory ABI - for token creation and trading functionality (complete ABI)
exports.ACES_FACTORY_ABI = [
    { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
    {
        type: 'function',
        name: 'UPGRADE_INTERFACE_VERSION',
        inputs: [],
        outputs: [{ name: '', type: 'string', internalType: 'string' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'acesTokenAddress',
        inputs: [],
        outputs: [{ name: '', type: 'address', internalType: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'buyTokens',
        inputs: [
            { name: 'tokenAddress', type: 'address', internalType: 'address' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' },
            { name: 'acesAmountIn', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'createToken',
        inputs: [
            { name: 'curve', type: 'uint8', internalType: 'enum AcesFactory.Curves' },
            { name: 'steepness', type: 'uint256', internalType: 'uint256' },
            { name: 'floor', type: 'uint256', internalType: 'uint256' },
            { name: 'name', type: 'string', internalType: 'string' },
            { name: 'symbol', type: 'string', internalType: 'string' },
            { name: 'salt', type: 'string', internalType: 'string' },
        ],
        outputs: [{ name: '', type: 'address', internalType: 'address' }],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getBuyPrice',
        inputs: [
            { name: 'tokenAddress', type: 'address', internalType: 'address' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getBuyPriceAfterFee',
        inputs: [
            { name: 'tokenAddress', type: 'address', internalType: 'address' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getPrice',
        inputs: [
            { name: 'tokenAddress', type: 'address', internalType: 'address' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' },
            { name: 'isBuy', type: 'bool', internalType: 'bool' },
        ],
        outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getPriceLinear',
        inputs: [
            { name: 'supply', type: 'uint256', internalType: 'uint256' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' },
            { name: 'steepness', type: 'uint256', internalType: 'uint256' },
            { name: 'floor', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'pure',
    },
    {
        type: 'function',
        name: 'getPriceQuadratic',
        inputs: [
            { name: 'supply', type: 'uint256', internalType: 'uint256' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' },
            { name: 'steepness', type: 'uint256', internalType: 'uint256' },
            { name: 'floor', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'pure',
    },
    {
        type: 'function',
        name: 'getSellPrice',
        inputs: [
            { name: 'tokenAddress', type: 'address', internalType: 'address' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getSellPriceAfterFee',
        inputs: [
            { name: 'tokenAddress', type: 'address', internalType: 'address' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'initialize',
        inputs: [{ name: 'initialOwner', type: 'address', internalType: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'owner',
        inputs: [],
        outputs: [{ name: '', type: 'address', internalType: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'protocolFeeDestination',
        inputs: [],
        outputs: [{ name: '', type: 'address', internalType: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'protocolFeePercent',
        inputs: [],
        outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'proxiableUUID',
        inputs: [],
        outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'renounceOwnership',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'sellTokens',
        inputs: [
            { name: 'tokenAddress', type: 'address', internalType: 'address' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'setAcesTokenAddress',
        inputs: [{ name: '_acesTokenAddress', type: 'address', internalType: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'setProtocolFeeDestination',
        inputs: [{ name: 'feeDestination', type: 'address', internalType: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'subjectFeePercent',
        inputs: [],
        outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'tokenImplementation',
        inputs: [],
        outputs: [{ name: '', type: 'address', internalType: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'tokens',
        inputs: [{ name: 'tokenAddress', type: 'address', internalType: 'address' }],
        outputs: [
            { name: 'curve', type: 'uint8', internalType: 'enum AcesFactory.Curves' },
            { name: 'tokenAddress', type: 'address', internalType: 'address' },
            { name: 'floor', type: 'uint256', internalType: 'uint256' },
            { name: 'steepness', type: 'uint256', internalType: 'uint256' },
            { name: 'acesTokenBalance', type: 'uint256', internalType: 'uint256' },
            { name: 'subjectFeeDestination', type: 'address', internalType: 'address' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'transferOwnership',
        inputs: [{ name: 'newOwner', type: 'address', internalType: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'upgradeToAndCall',
        inputs: [
            { name: 'newImplementation', type: 'address', internalType: 'address' },
            { name: 'data', type: 'bytes', internalType: 'bytes' },
        ],
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'withdrawACES',
        inputs: [{ name: 'tokenAddress', type: 'address', internalType: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'withdrawETH',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'event',
        name: 'CreatedToken',
        inputs: [
            { name: 'tokenAddress', type: 'address', indexed: false, internalType: 'address' },
            { name: 'curve', type: 'uint8', indexed: false, internalType: 'uint8' },
            { name: 'steepness', type: 'uint256', indexed: false, internalType: 'uint256' },
            { name: 'floor', type: 'uint256', indexed: false, internalType: 'uint256' },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'FeeDestinationChanged',
        inputs: [{ name: 'newDestination', type: 'address', indexed: false, internalType: 'address' }],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'Initialized',
        inputs: [{ name: 'version', type: 'uint64', indexed: false, internalType: 'uint64' }],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'OwnershipTransferred',
        inputs: [
            { name: 'previousOwner', type: 'address', indexed: true, internalType: 'address' },
            { name: 'newOwner', type: 'address', indexed: true, internalType: 'address' },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'ProtocolFeePercentChanged',
        inputs: [{ name: 'newPercent', type: 'uint256', indexed: false, internalType: 'uint256' }],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'SellApprovalChanged',
        inputs: [
            { name: 'seller', type: 'address', indexed: true, internalType: 'address' },
            { name: 'operator', type: 'address', indexed: true, internalType: 'address' },
            { name: 'approved', type: 'bool', indexed: false, internalType: 'bool' },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'SubjectFeePercentChanged',
        inputs: [{ name: 'newPercent', type: 'uint256', indexed: false, internalType: 'uint256' }],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'Trade',
        inputs: [
            { name: 'tokenAddress', type: 'address', indexed: false, internalType: 'address' },
            { name: 'isBuy', type: 'bool', indexed: false, internalType: 'bool' },
            { name: 'tokenAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
            { name: 'acesAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
            { name: 'protocolAcesAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
            { name: 'subjectAcesAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
            { name: 'supply', type: 'uint256', indexed: false, internalType: 'uint256' },
        ],
        anonymous: false,
    },
    {
        type: 'error',
        name: 'AddressEmptyCode',
        inputs: [{ name: 'target', type: 'address', internalType: 'address' }],
    },
    {
        type: 'error',
        name: 'ERC1967InvalidImplementation',
        inputs: [{ name: 'implementation', type: 'address', internalType: 'address' }],
    },
    {
        type: 'error',
        name: 'ERC1967NonPayable',
        inputs: [],
    },
    {
        type: 'error',
        name: 'FailedCall',
        inputs: [],
    },
    {
        type: 'error',
        name: 'InvalidInitialization',
        inputs: [],
    },
    {
        type: 'error',
        name: 'NotInitializing',
        inputs: [],
    },
    {
        type: 'error',
        name: 'OwnableInvalidOwner',
        inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
    },
    {
        type: 'error',
        name: 'OwnableUnauthorizedAccount',
        inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    },
    {
        type: 'error',
        name: 'UUPSUnauthorizedCallContext',
        inputs: [],
    },
    {
        type: 'error',
        name: 'UUPSUnsupportedProxiableUUID',
        inputs: [{ name: 'slot', type: 'bytes32', internalType: 'bytes32' }],
    },
];
// Exported for convenience
exports.ABIS = {
    AcesVault: exports.ACES_VAULT_ABI,
    AcesSwap: exports.ACES_SWAP_ABI,
    AcesFactory: exports.ACES_FACTORY_ABI,
    ERC20: exports.ERC20_ABI,
};
//# sourceMappingURL=abis.js.map