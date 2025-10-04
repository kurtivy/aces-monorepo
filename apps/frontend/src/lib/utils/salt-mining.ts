import { ethers } from 'ethers';

export interface SaltMiningOptions {
  targetSuffix: string; // 'ace'
  maxAttempts: number;
  onProgress?: (attempts: number, timeElapsed: number) => void;
}

export interface SaltMiningResult {
  salt: string;
  predictedAddress: string;
  attempts: number;
  timeElapsed: number;
}

/**
 * Generate unique salt that will create vanity address ending in target suffix
 */
export async function mineVanitySalt(
  userAddress: string,
  tokenName: string,
  tokenSymbol: string,
  factoryAddress: string,
  tokenImplementation: string,
  options: SaltMiningOptions,
): Promise<SaltMiningResult> {
  const { targetSuffix, maxAttempts, onProgress } = options;
  const startTime = Date.now();

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    // Create unique salt using multiple randomness sources
    const timestamp = Date.now();
    const random1 = Math.floor(Math.random() * 1000000);
    const random2 = Math.floor(Math.random() * 1000000);
    const nonce = attempts;

    const salt = `${userAddress}-${tokenName}-${tokenSymbol}-${timestamp}-${random1}-${random2}-${nonce}`;

    // Predict cloneDeterministic address
    const predictedAddress = predictCloneDeterministicAddress(
      salt,
      userAddress,
      factoryAddress,
      tokenImplementation,
      tokenName,
      tokenSymbol,
    );

    // Check if the lowercase address ends with the target suffix (in lowercase)
    if (predictedAddress.endsWith(targetSuffix.toLowerCase())) {
      // Apply proper checksumming to the final address
      const checksummedAddress = ethers.utils.getAddress(predictedAddress);

      // Check that the checksummed address ends with the exact target suffix (with correct case)
      if (checksummedAddress.endsWith(targetSuffix)) {
        return {
          salt,
          predictedAddress: checksummedAddress,
          attempts: attempts + 1,
          timeElapsed: Date.now() - startTime,
        };
      }
      // If checksumming didn't produce the desired case, continue mining
    }

    // Report progress every 250 attempts
    if (attempts % 250 === 0 && onProgress) {
      onProgress(attempts + 1, Date.now() - startTime);
    }

    // Yield control to prevent UI blocking
    if (attempts % 100 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  throw new Error(
    `Could not find vanity address ending in "${targetSuffix}" after ${maxAttempts} attempts`,
  );
}

/**
 * Predict cloneDeterministic address - must match factory implementation exactly
 * Mainnet Factory uses: Clones.cloneDeterministic(tokenImplementation, keccak256(abi.encodePacked(name, symbol, salt, msg.sender)))
 */
export function predictCloneDeterministicAddress(
  salt: string,
  userAddress: string,
  factoryAddress: string,
  tokenImplementation: string,
  tokenName: string,
  tokenSymbol: string,
): string {
  // Step 1: Pack salt with name, symbol, and user address exactly like mainnet factory does
  // Mainnet Factory: bytes32 saltPacked = keccak256(abi.encodePacked(name, symbol, salt, msg.sender));
  const saltPacked = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['string', 'string', 'string', 'address'],
      [tokenName, tokenSymbol, salt, userAddress],
    ),
  );

  // Step 2: Use OpenZeppelin Clones.cloneDeterministic prediction
  // Clones library formula: create2(deployer, saltPacked, cloneInitCode)
  // where cloneInitCode = abi.encodePacked(hex"3d602d80600a3d3981f3363d3d373d3d3d363d73", implementation, hex"5af43d82803e903d91602b57fd5bf3")

  const cloneInitCode = ethers.utils.solidityPack(
    ['bytes', 'address', 'bytes'],
    [
      '0x3d602d80600a3d3981f3363d3d373d3d3d363d73',
      tokenImplementation,
      '0x5af43d82803e903d91602b57fd5bf3',
    ],
  );

  const cloneInitCodeHash = ethers.utils.keccak256(cloneInitCode);

  // Step 3: Predict CREATE2 address using factory as deployer
  const create2Input = ethers.utils.solidityPack(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', factoryAddress, saltPacked, cloneInitCodeHash],
  );

  const hash = ethers.utils.keccak256(create2Input);
  // Return lowercase address first, checksum will be applied later if needed
  return '0x' + hash.slice(-40).toLowerCase();
}

// Note: We no longer need calculateInitCodeHash since we're using Clones.cloneDeterministic
// which uses a fixed init code pattern for all clones

/**
 * Mine vanity salt with timeout and fallback
 */
export async function mineVanitySaltWithTimeout(
  userAddress: string,
  tokenName: string,
  tokenSymbol: string,
  factoryAddress: string,
  tokenImplementation: string,
  options: SaltMiningOptions,
  timeoutMs: number = 300000, // 5 minutes
): Promise<SaltMiningResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Vanity mining timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    mineVanitySalt(
      userAddress,
      tokenName,
      tokenSymbol,
      factoryAddress,
      tokenImplementation,
      options,
    )
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}
