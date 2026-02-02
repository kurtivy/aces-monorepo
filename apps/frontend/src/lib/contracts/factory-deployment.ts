import { ethers } from 'ethers';
import { ACES_FACTORY_ABI } from '@/lib/contracts/abi';

/**
 * Deploy a new AcesFactory implementation contract
 * Note: This requires the factory bytecode. If bytecode is not available,
 * the factory should be deployed via a deployment script and the address
 * should be entered manually in the UI.
 */
export async function deployFactoryImplementation(
  signer: ethers.Signer,
  bytecode?: string,
): Promise<{ implementationAddress: string; txHash: string }> {
  if (!bytecode) {
    throw new Error(
      'Factory bytecode not provided. Please deploy the factory contract via a deployment script and enter the address manually.',
    );
  }

  const factoryFactory = new ethers.ContractFactory(ACES_FACTORY_ABI, bytecode, signer);
  const factory = await factoryFactory.deploy();
  await factory.deployed();

  return {
    implementationAddress: factory.address,
    txHash: factory.deployTransaction.hash,
  };
}

/**
 * Deploy a UUPS proxy for the factory implementation
 * Note: This requires the ERC1967Proxy bytecode
 */
export async function deployFactoryProxy(
  signer: ethers.Signer,
  implementationAddress: string,
  initialOwner: string,
  proxyBytecode?: string,
): Promise<{ proxyAddress: string; txHash: string }> {
  if (!proxyBytecode) {
    throw new Error(
      'Proxy bytecode not provided. Please deploy the proxy via a deployment script and enter the address manually.',
    );
  }

  // Encode the initialize function call
  const factoryInterface = new ethers.utils.Interface(ACES_FACTORY_ABI);
  const initData = factoryInterface.encodeFunctionData('initialize', [initialOwner]);

  // Deploy proxy with implementation address and init data
  const proxyFactory = new ethers.ContractFactory(
    [
      {
        inputs: [
          { internalType: 'address', name: '_logic', type: 'address' },
          { internalType: 'bytes', name: '_data', type: 'bytes' },
        ],
        stateMutability: 'payable',
        type: 'constructor',
      },
    ],
    proxyBytecode,
    signer,
  );

  const proxy = await proxyFactory.deploy(implementationAddress, initData);
  await proxy.deployed();

  return {
    proxyAddress: proxy.address,
    txHash: proxy.deployTransaction.hash,
  };
}

/**
 * Initialize a newly deployed factory with required parameters
 */
export async function initializeFactory(
  factoryAddress: string,
  signer: ethers.Signer,
  config: {
    acesTokenAddress: string;
    tokenImplementation: string;
    liquidityManager?: string;
    protocolFeeDestination?: string;
  },
): Promise<void> {
  const factory = new ethers.Contract(factoryAddress, ACES_FACTORY_ABI, signer);

  // Set ACES token address
  const setAcesTx = await factory.setAcesTokenAddress(config.acesTokenAddress);
  await setAcesTx.wait();

  // Set token implementation
  const setImplTx = await factory.setTokenImplementation(config.tokenImplementation);
  await setImplTx.wait();

  // Set liquidity manager if provided
  if (config.liquidityManager) {
    const setLiquidityTx = await factory.setLiquidityManager(config.liquidityManager);
    await setLiquidityTx.wait();
  }

  // Set protocol fee destination if provided
  if (config.protocolFeeDestination) {
    const setFeeDestTx = await factory.setProtocolFeeDestination(config.protocolFeeDestination);
    await setFeeDestTx.wait();
  }
}

/**
 * Verify a factory contract is properly initialized
 */
export async function verifyFactoryInitialization(
  factoryAddress: string,
  provider: ethers.providers.Provider,
): Promise<{
  isValid: boolean;
  acesTokenAddress: string | null;
  tokenImplementation: string | null;
  owner: string | null;
  errors: string[];
}> {
  const factory = new ethers.Contract(factoryAddress, ACES_FACTORY_ABI, provider);
  const errors: string[] = [];

  try {
    const acesTokenAddress = await factory.acesTokenAddress();
    const tokenImplementation = await factory.tokenImplementation();
    const owner = await factory.owner();

    if (acesTokenAddress === ethers.constants.AddressZero) {
      errors.push('ACES token address not set');
    }
    if (tokenImplementation === ethers.constants.AddressZero) {
      errors.push('Token implementation not set');
    }
    if (owner === ethers.constants.AddressZero) {
      errors.push('Owner not set');
    }

    return {
      isValid: errors.length === 0,
      acesTokenAddress: acesTokenAddress !== ethers.constants.AddressZero ? acesTokenAddress : null,
      tokenImplementation:
        tokenImplementation !== ethers.constants.AddressZero ? tokenImplementation : null,
      owner: owner !== ethers.constants.AddressZero ? owner : null,
      errors,
    };
  } catch (error) {
    return {
      isValid: false,
      acesTokenAddress: null,
      tokenImplementation: null,
      owner: null,
      errors: [`Failed to verify factory: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
