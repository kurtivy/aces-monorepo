import { ethers } from 'ethers';
import { FIXED_SUPPLY_ERC20_ABI } from './abi/fixed-supply-erc20-abi';

/**
 * Fixed Supply ERC20 Contract Source
 * This will be used to compile and get bytecode for CREATE2 deployment
 */
const FIXED_SUPPLY_ERC20_SOURCE = `
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FixedSupplyERC20 is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    address public immutable creator;
    
    constructor(
        string memory name,
        string memory symbol,
        address _creator
    ) ERC20(name, symbol) {
        require(_creator != address(0), "FixedSupplyERC20: creator cannot be zero address");
        creator = _creator;
        _mint(_creator, TOTAL_SUPPLY);
    }
    
    function _mint(address to, uint256 amount) internal override {
        require(totalSupply() == 0, "FixedSupplyERC20: cannot mint after deployment");
        super._mint(to, amount);
    }
}
`;

export interface DeployFixedSupplyTokenParams {
  name: string;
  symbol: string;
  salt: string;
  creator: string;
}

export interface FixedSupplyTokenDeploymentResult {
  success: boolean;
  tokenAddress?: string;
  txHash?: string;
  error?: string;
  warning?: string;
  verifiedData?: {
    name: string;
    symbol: string;
    totalSupply: string;
    creatorBalance: string;
    decimals: string;
  };
}

/** Retry getCode a few times with delay; RPC often lags indexing new contracts after tx confirms. */
async function getCodeWithRetry(
  provider: ethers.providers.Provider | null | undefined,
  address: string,
  options: { maxAttempts?: number; delayMs?: number } = {},
): Promise<string> {
  if (!provider) return '0x';
  const { maxAttempts = 5, delayMs = 1500 } = options;
  let code = '0x';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    code = await provider.getCode(address);
    if (code && code !== '0x') return code;
    if (attempt < maxAttempts) {
      console.log(
        `[getCode] No code at ${address} yet (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms...`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return code || '0x';
}

/**
 * Predict the CREATE2 address for a FixedSupplyERC20 token deployment
 * @param salt The salt for CREATE2 deployment
 * @param deployer The address that will deploy the contract
 * @param name Token name
 * @param symbol Token symbol
 * @param creator Address that will receive all tokens
 * @param bytecode The contract bytecode (with constructor parameters encoded)
 * @returns The predicted contract address
 */
export function predictFixedSupplyTokenAddress(
  salt: string,
  deployer: string,
  name: string,
  symbol: string,
  creator: string,
  bytecode: string,
): string {
  // CREATE2 formula: keccak256(0xff ++ deployer ++ salt ++ keccak256(init_code))
  // init_code = bytecode + encoded constructor parameters

  // Encode constructor parameters: (string name, string symbol, address creator)
  const constructorParams = ethers.utils.defaultAbiCoder.encode(
    ['string', 'string', 'address'],
    [name, symbol, creator],
  );

  // Init code is the bytecode + constructor parameters
  // Remove 0x prefix from bytecode and params, then combine
  const bytecodeClean = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
  const paramsClean = constructorParams.startsWith('0x')
    ? constructorParams.slice(2)
    : constructorParams;
  const initCode = '0x' + bytecodeClean + paramsClean;

  // Hash the init code
  const initCodeHash = ethers.utils.keccak256(initCode);

  // Convert salt to bytes32 if it's a string
  let saltBytes32: string;
  if (salt.startsWith('0x') && salt.length === 66) {
    saltBytes32 = salt;
  } else {
    // Hash the salt string to get bytes32
    saltBytes32 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(salt));
  }

  // CREATE2 address calculation
  const create2Input = ethers.utils.solidityPack(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', deployer, saltBytes32, initCodeHash],
  );

  const hash = ethers.utils.keccak256(create2Input);

  // Return last 20 bytes (40 hex chars) as address
  return ethers.utils.getAddress('0x' + hash.slice(-40));
}

/**
 * Get the bytecode for FixedSupplyERC20 contract
 * Note: This requires the contract to be compiled. In production, you should:
 * 1. Compile the contract using Hardhat/Foundry
 * 2. Extract the bytecode from the compilation artifacts
 * 3. Store it as a constant or fetch from a service
 *
 * For now, this function will attempt to get bytecode from ContractFactory
 * @param signer The signer to use for ContractFactory
 * @returns The contract bytecode (without constructor parameters)
 */
export async function getFixedSupplyTokenBytecode(signer: ethers.Signer): Promise<string> {
  try {
    // Create ContractFactory from ABI and source
    // Note: This requires the contract to be available in the environment
    // In a real implementation, you'd compile the contract and import the bytecode

    // For now, we'll use a placeholder approach
    // The actual bytecode should come from compilation artifacts
    throw new Error(
      'Contract bytecode must be compiled. Please compile FixedSupplyERC20.sol and provide the bytecode.',
    );
  } catch (error) {
    console.error('Failed to get contract bytecode:', error);
    throw error;
  }
}

/**
 * CREATE2 Deployer ABI
 */
const CREATE2_DEPLOYER_ABI = [
  'function deploy(bytes bytecode, bytes32 salt) external returns (address deployedAddress)',
  'function computeAddress(bytes bytecode, bytes32 salt) external view returns (address)',
];

/**
 * FixedSupplyERC20Factory ABI (low-gas deploys; bytecode embedded in contract)
 */
const FIXED_SUPPLY_FACTORY_ABI = [
  'function deployFixedSupplyERC20(string name, string symbol, address creator, bytes32 salt) external returns (address deployed)',
  'function computeAddress(string name, string symbol, address creator, bytes32 salt) external view returns (address)',
];

/**
 * Deploy a FixedSupplyERC20 token using CREATE2.
 * Uses FixedSupplyERC20Factory when provided (much lower gas); otherwise CREATE2Deployer + bytecode.
 *
 * @param signer The signer to deploy the contract
 * @param params Deployment parameters
 * @param bytecode The contract bytecode (required for CREATE2Deployer path; used for prediction when using factory)
 * @param deployerAddress The CREATE2Deployer contract address (used when factoryAddress is not set)
 * @param factoryAddress Optional FixedSupplyERC20Factory address. When set and valid, uses it for low-gas deploy (no bytecode in tx).
 */
export async function deployFixedSupplyToken(
  signer: ethers.Signer,
  params: DeployFixedSupplyTokenParams,
  bytecode: string,
  deployerAddress?: string,
  factoryAddress?: string,
): Promise<FixedSupplyTokenDeploymentResult> {
  try {
    const userAddress = await signer.getAddress();

    // Convert salt to bytes32
    let saltBytes32: string;
    if (params.salt.startsWith('0x') && params.salt.length === 66) {
      saltBytes32 = params.salt;
    } else {
      saltBytes32 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(params.salt));
    }

    const useFactory =
      !!factoryAddress &&
      factoryAddress !== '0x0000000000000000000000000000000000000000' &&
      factoryAddress.trim().length >= 42;

    let deployer: string;
    let predictedAddress: string;
    let computedAddress: string;

    if (useFactory) {
      const factoryCode = await signer.provider?.getCode(factoryAddress!);
      if (!factoryCode || factoryCode === '0x') {
        console.warn(
          'FixedSupplyERC20Factory not found at',
          factoryAddress,
          '- falling back to CREATE2Deployer',
        );
      } else {
        deployer = factoryAddress!;
        console.log(`✅ Using FixedSupplyERC20Factory (low gas) at ${deployer}`);

        if (!bytecode || bytecode.trim().length < 200) {
          return {
            success: false,
            error:
              'Bytecode is required for address prediction (e.g. vanity mining). Click "Load default bytecode" even when using the factory.',
          };
        }
        predictedAddress = predictFixedSupplyTokenAddress(
          params.salt,
          deployer,
          params.name,
          params.symbol,
          params.creator,
          bytecode,
        );
        computedAddress = predictedAddress;

        const code = await signer.provider?.getCode(predictedAddress);
        if (code && code !== '0x') {
          return {
            success: false,
            error: `Contract already exists at address ${predictedAddress}`,
          };
        }

        const factory = new ethers.Contract(deployer, FIXED_SUPPLY_FACTORY_ABI, signer);
        try {
          computedAddress = await factory.computeAddress(
            params.name,
            params.symbol,
            params.creator,
            saltBytes32,
          );
          if (computedAddress.toLowerCase() !== predictedAddress.toLowerCase()) {
            console.warn(
              'Factory computeAddress differs from local prediction; using factory:',
              computedAddress,
            );
          }
        } catch (e) {
          console.warn('Factory computeAddress failed, using local prediction:', e);
        }

        const tx = await factory.deployFixedSupplyERC20(
          params.name,
          params.symbol,
          params.creator,
          saltBytes32,
        );
        console.log(`Deployment tx sent (factory): ${tx.hash}`);
        const receipt = await tx.wait();

        if (receipt.status === 0) {
          return {
            success: false,
            error: `Transaction reverted. Hash: ${receipt.transactionHash}. Check the block explorer for details.`,
          };
        }

        let deployedAddress = computedAddress;
        // RPC often returns no code immediately after tx confirms; retry with short delays
        const deployedCode = await getCodeWithRetry(signer.provider, deployedAddress);
        if (!deployedCode || deployedCode === '0x') {
          // Tx succeeded but RPC still shows no code (indexing lag). Return success so the
          // frontend can still save the token to DB; user can confirm on block explorer.
          console.warn(
            `[Factory] Tx ${receipt.transactionHash} succeeded but getCode still empty at ${deployedAddress}; returning success so token can be saved to DB`,
          );
          return {
            success: true,
            tokenAddress: deployedAddress,
            txHash: receipt.transactionHash,
            warning: `Transaction succeeded but RPC reported no code at address yet (indexing delay). Token created at ${deployedAddress}. You can confirm on block explorer and it will be saved to the database.`,
          };
        }

        const tokenContract = new ethers.Contract(deployedAddress, FIXED_SUPPLY_ERC20_ABI, signer);
        let verifiedData;
        try {
          const [name, symbol, totalSupply, creatorBalance, decimals] = await Promise.all([
            tokenContract.name(),
            tokenContract.symbol(),
            tokenContract.totalSupply(),
            tokenContract.balanceOf(params.creator),
            tokenContract.decimals(),
          ]);
          verifiedData = {
            name,
            symbol,
            totalSupply: totalSupply.toString(),
            creatorBalance: creatorBalance.toString(),
            decimals: decimals.toString(),
          };
        } catch (e) {
          console.warn('Post-deploy verification failed:', e);
        }

        return {
          success: true,
          tokenAddress: deployedAddress,
          txHash: receipt.transactionHash,
          verifiedData,
        };
      }
    }

    // CREATE2Deployer path (or factory not available)
    if (!bytecode || bytecode.trim() === '') {
      return {
        success: false,
        error:
          'Bytecode is required. Please compile FixedSupplyERC20.sol and provide the creation bytecode (not runtime bytecode).',
      };
    }

    const bytecodeWithPrefix = bytecode.startsWith('0x') ? bytecode : '0x' + bytecode;
    if (bytecodeWithPrefix.length < 200) {
      return {
        success: false,
        error: `Bytecode appears too short (${bytecodeWithPrefix.length} chars). Expected creation bytecode (typically 1000+ hex characters). Did you provide runtime bytecode instead?`,
      };
    }

    const constructorParams = ethers.utils.defaultAbiCoder.encode(
      ['string', 'string', 'address'],
      [params.name, params.symbol, params.creator],
    );
    const bytecodeClean = bytecodeWithPrefix.startsWith('0x')
      ? bytecodeWithPrefix.slice(2)
      : bytecodeWithPrefix;
    const paramsClean = constructorParams.startsWith('0x')
      ? constructorParams.slice(2)
      : constructorParams;
    const initCode = '0x' + bytecodeClean + paramsClean;

    console.log(
      `InitCode: bytecode=${bytecodeClean.length} chars, params=${paramsClean.length} chars`,
    );

    if (!deployerAddress) {
      return {
        success: false,
        error: 'CREATE2Deployer address is required when not using FixedSupplyERC20Factory.',
      };
    }

    deployer = deployerAddress;
    const deployerCode = await signer.provider?.getCode(deployer);
    if (!deployerCode || deployerCode === '0x') {
      let networkInfo = '';
      try {
        const network = await signer.provider?.getNetwork();
        if (network) networkInfo = ` (Network: ${network.name}, Chain ID: ${network.chainId})`;
      } catch {
        /* ignore */
      }
      return {
        success: false,
        error: `CREATE2Deployer not found at ${deployer}${networkInfo}. Deploy it or use FixedSupplyERC20Factory.`,
      };
    }
    console.log(`✅ CREATE2Deployer verified at ${deployer}`);

    predictedAddress = predictFixedSupplyTokenAddress(
      params.salt,
      deployer,
      params.name,
      params.symbol,
      params.creator,
      bytecode,
    );

    const code = await signer.provider?.getCode(predictedAddress);
    if (code && code !== '0x') {
      return {
        success: false,
        error: `Contract already exists at address ${predictedAddress}`,
      };
    }

    const deployerContract = new ethers.Contract(deployer, CREATE2_DEPLOYER_ABI, signer);

    // First, verify the predicted address matches what the contract would compute
    // This helps us catch any initCode format issues before deployment
    computedAddress = predictedAddress;
    try {
      const contractComputedAddress = await deployerContract.computeAddress(initCode, saltBytes32);
      computedAddress = contractComputedAddress;

      if (computedAddress.toLowerCase() !== predictedAddress.toLowerCase()) {
        console.error(`⚠️ Address mismatch detected!`);
        console.error(`  Predicted (JS): ${predictedAddress}`);
        console.error(`  Computed (Contract): ${computedAddress}`);
        console.error(`  InitCode length: ${initCode.length} bytes`);
        console.error(`  InitCode (first 200 chars): ${initCode.substring(0, 200)}`);
        console.error(`  Salt: ${saltBytes32}`);
        console.error(`  Bytecode length: ${bytecode.length} chars`);
        // Use the contract's computed address as it's the source of truth
        computedAddress = contractComputedAddress;
      } else {
        console.log(`✅ Address prediction matches contract computation: ${computedAddress}`);
      }
    } catch (error) {
      console.warn(
        '⚠️ Failed to call computeAddress before deployment, will use predicted address:',
        error instanceof Error ? error.message : error,
      );
    }

    // Try to simulate the deployment first using callStatic to catch revert reasons early
    try {
      console.log('🔍 Simulating deployment transaction...');
      const simulatedAddress = await deployerContract.callStatic.deploy(initCode, saltBytes32);
      console.log(`✅ Simulation successful, would deploy to: ${simulatedAddress}`);

      // Verify the simulated address matches our prediction
      if (simulatedAddress.toLowerCase() !== computedAddress.toLowerCase()) {
        console.warn(
          `⚠️ Simulated address (${simulatedAddress}) doesn't match computed address (${computedAddress})`,
        );
        computedAddress = simulatedAddress;
      }
    } catch (simulationError: any) {
      // If simulation fails, the actual deployment will likely fail too
      let errorMessage = 'Unknown simulation error';
      if (simulationError?.reason) {
        errorMessage = simulationError.reason;
      } else if (simulationError?.data) {
        try {
          const decoded = deployerContract.interface.parseError(simulationError.data);
          errorMessage = decoded?.name || 'Contract reverted during simulation';
        } catch {
          errorMessage = `Revert data: ${simulationError.data}`;
        }
      } else if (simulationError?.message) {
        errorMessage = simulationError.message;
      }

      return {
        success: false,
        error: `Deployment simulation failed: ${errorMessage}. This usually means:\n1. The bytecode is incorrect (should be creation bytecode, not runtime bytecode)\n2. The CREATE2Deployer contract is not working correctly\n3. The contract would revert during deployment\n\nPlease verify:\n- Bytecode is creation bytecode from compilation\n- CREATE2Deployer contract is correctly deployed\n- All parameters are correct`,
      };
    }

    // Call deploy function
    console.log(
      `Deploying contract with initCode length: ${initCode.length}, salt: ${saltBytes32}`,
    );
    console.log(`InitCode (first 200 chars): ${initCode.substring(0, 200)}...`);
    console.log(`Bytecode length: ${bytecode.length} chars`);

    // Call the deploy function
    // The function should return the deployed address, but in ethers v5 we can't easily get it from the receipt
    const tx = await deployerContract.deploy(initCode, saltBytes32);
    console.log(`Deployment transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Deployment transaction confirmed in block: ${receipt.blockNumber}`);

    // Try to get the return value by calling the function again with callStatic
    // This won't execute, but will show us what the function returns
    // Actually, we can't do this easily in ethers v5, so we'll rely on events and address computation

    // Check if transaction reverted
    if (receipt.status === 0) {
      // Transaction reverted - try to get revert reason
      let revertReason = 'Unknown revert reason';
      try {
        // Try to call the transaction again with callStatic to get revert reason
        await deployerContract.callStatic.deploy(initCode, saltBytes32);
      } catch (staticError: any) {
        if (staticError?.reason) {
          revertReason = staticError.reason;
        } else if (staticError?.data) {
          // Try to decode the revert reason
          try {
            const decoded = deployerContract.interface.parseError(staticError.data);
            revertReason = decoded?.name || 'Contract reverted';
          } catch {
            revertReason = `Revert data: ${staticError.data}`;
          }
        } else if (staticError?.message) {
          revertReason = staticError.message;
        }
      }

      return {
        success: false,
        error: `Transaction reverted: ${revertReason}. Transaction hash: ${receipt.transactionHash}. Please check the transaction on a block explorer.`,
      };
    }

    // Try to get the deployed address from the transaction return value
    // In ethers v5, we need to parse the receipt logs or use callStatic
    let deployedAddress = computedAddress;

    // First, try to get the return value by calling the function with callStatic
    // (This won't execute, but will show us what would be returned)
    try {
      // Actually, we can't get return values from receipts in ethers v5 easily
      // But we can check the receipt for the deployed address in events
    } catch (e) {
      console.warn('Could not get return value from deploy function:', e);
    }

    // The deploy function should return the deployed address
    // In ethers v5, we can try to decode it from the transaction receipt
    // First, check if there's a return value in the receipt (unlikely in v5)
    // Then check logs for events

    // Check if CREATE2Deployer emits a Deployed event
    // Standard CREATE2Deployer contracts often emit: event Deployed(address indexed deployedAddress, bytes32 salt)
    const DEPLOYED_EVENT_ABI = [
      'event Deployed(address indexed deployedAddress, bytes32 salt)',
      'event ContractDeployed(address indexed deployedAddress, bytes32 salt)',
    ];

    // Try to parse logs with different event signatures
    for (const eventSig of DEPLOYED_EVENT_ABI) {
      try {
        const eventInterface = new ethers.utils.Interface([eventSig]);
        for (const log of receipt.logs) {
          try {
            const parsedLog = eventInterface.parseLog(log);
            if (parsedLog && parsedLog.args && parsedLog.args.deployedAddress) {
              const eventAddress = parsedLog.args.deployedAddress;
              console.log(`Found deployed address in event: ${eventAddress}`);
              // Verify it has code
              const code = await signer.provider?.getCode(eventAddress);
              if (code && code !== '0x') {
                deployedAddress = eventAddress;
                console.log(`✅ Using deployed address from event: ${deployedAddress}`);
                break;
              }
            }
          } catch (e) {
            // Not this event signature, continue
          }
        }
        if (deployedAddress !== computedAddress) break;
      } catch (e) {
        // Event interface creation failed, continue
      }
    }

    // Also check all logs for any address that might be the deployed contract
    for (const log of receipt.logs) {
      try {
        const parsedLog = deployerContract.interface.parseLog(log);
        if (parsedLog && parsedLog.args) {
          // Check if any argument is an address that matches our pattern
          const args = Object.values(parsedLog.args);
          for (const arg of args) {
            if (typeof arg === 'string' && arg.startsWith('0x') && arg.length === 42) {
              // This might be the deployed address
              if (
                arg.toLowerCase() !== deployer.toLowerCase() &&
                arg.toLowerCase() !== userAddress.toLowerCase()
              ) {
                console.log(`Found potential deployed address in log: ${arg}`);
                // Verify it has code
                const code = await signer.provider?.getCode(arg);
                if (code && code !== '0x') {
                  deployedAddress = arg;
                  console.log(`✅ Using deployed address from log: ${deployedAddress}`);
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        // Not a log we can parse, continue
      }
    }

    // Also check for contract creation in the receipt (contractAddress field)
    if (receipt.contractAddress && receipt.contractAddress !== deployer) {
      console.log(`Found contractAddress in receipt: ${receipt.contractAddress}`);
      const code = await signer.provider?.getCode(receipt.contractAddress);
      if (code && code !== '0x') {
        deployedAddress = receipt.contractAddress;
        console.log(`✅ Using contractAddress from receipt: ${deployedAddress}`);
      }
    }

    // Verify the contract was actually deployed (retry getCode; RPC often lags after tx confirms)
    let deployedCode = await getCodeWithRetry(signer.provider, deployedAddress);
    if (!deployedCode || deployedCode === '0x') {
      // Try the predicted address as fallback
      if (deployedAddress.toLowerCase() !== predictedAddress.toLowerCase()) {
        const predictedCode = await getCodeWithRetry(signer.provider, predictedAddress);
        if (predictedCode && predictedCode !== '0x') {
          deployedAddress = predictedAddress;
          deployedCode = predictedCode;
          console.warn(`✅ Contract found at predicted address ${predictedAddress}`);
        }
      }

      const finalCode = deployedCode || (await getCodeWithRetry(signer.provider, deployedAddress));
      if (!finalCode || finalCode === '0x') {
        // Tx succeeded but RPC still shows no code; return success so frontend can save to DB
        console.warn(
          `[CREATE2] Tx ${receipt.transactionHash} succeeded but getCode still empty at ${deployedAddress}; returning success so token can be saved to DB`,
        );
        return {
          success: true,
          tokenAddress: deployedAddress,
          txHash: receipt.transactionHash,
          warning: `Transaction succeeded but RPC reported no code at address yet (indexing delay). Token at ${deployedAddress}. Confirm on block explorer; it will be saved to the database.`,
        };
      }
    }

    console.log(`✅ Contract successfully deployed at: ${deployedAddress}`);

    // Verify the token was minted correctly by checking on-chain data
    const tokenContract = new ethers.Contract(deployedAddress, FIXED_SUPPLY_ERC20_ABI, signer);

    try {
      // Verify token properties (best-effort; never report failure if contract is deployed)
      const [name, symbol, totalSupply, creatorBalance, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.totalSupply(),
        tokenContract.balanceOf(params.creator),
        tokenContract.decimals(),
      ]);

      const expectedSupply = ethers.utils.parseEther('1000000000'); // 1 billion
      const nameSymbolOk = name === params.name && symbol === params.symbol;
      const supplyOk = totalSupply.eq(expectedSupply);
      const balanceOk = creatorBalance.eq(totalSupply);

      if (nameSymbolOk && supplyOk && balanceOk) {
        console.log('✅ Token verified on-chain:', {
          address: deployedAddress,
          name,
          symbol,
          totalSupply: ethers.utils.formatEther(totalSupply),
          creatorBalance: ethers.utils.formatEther(creatorBalance),
          decimals: decimals.toString(),
        });
        return {
          success: true,
          tokenAddress: deployedAddress,
          txHash: receipt.transactionHash,
          verifiedData: {
            name,
            symbol,
            totalSupply: totalSupply.toString(),
            creatorBalance: creatorBalance.toString(),
            decimals: decimals.toString(),
          },
        };
      }

      // Contract is deployed but verification checks failed — still return success so the
      // frontend can save to DB and add to Convex; surface as warning only.
      const warnings: string[] = [];
      if (!nameSymbolOk)
        warnings.push(
          `name/symbol mismatch: expected ${params.name}/${params.symbol}, got ${name}/${symbol}`,
        );
      if (!supplyOk)
        warnings.push(
          `total supply: expected ${expectedSupply.toString()}, got ${totalSupply.toString()}`,
        );
      if (!balanceOk)
        warnings.push(
          `creator balance: expected ${totalSupply.toString()}, got ${creatorBalance.toString()}`,
        );
      console.warn('Token deployed but verification warnings:', warnings);
      return {
        success: true,
        tokenAddress: deployedAddress,
        txHash: receipt.transactionHash,
        warning: `Deployment succeeded; verification warnings: ${warnings.join('; ')}`,
        verifiedData: {
          name,
          symbol,
          totalSupply: totalSupply.toString(),
          creatorBalance: creatorBalance.toString(),
          decimals: decimals.toString(),
        },
      };
    } catch (verifyError) {
      console.error('Token verification error:', verifyError);
      // Still return success if deployment worked, but log the verification error
      return {
        success: true,
        tokenAddress: deployedAddress,
        txHash: receipt.transactionHash,
        warning: `Deployment succeeded but verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    console.error('Failed to deploy FixedSupplyERC20:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown deployment error',
    };
  }
}
