'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Coins, Loader2, Pickaxe, CheckCircle, AlertCircle } from 'lucide-react';
import { useTokenLaunch } from '../context';

export function FixedSupplyTokenCard() {
  const {
    effectiveWalletAddress,
    fixedSupplyDeployment,
    setFixedSupplyDeployment,
    createForm,
    setCreateForm,
    deployerValidation,
    useFactory,
    fixedSupplyFactory,
    contractAddresses,
    currentChainId,
    isOnBaseSepolia,
    isOnBaseMainnet,
    switchToChain,
    SUPPORTED_CHAINS,
    setChainSwitchFeedback,
    isMining,
    miningProgress,
    saltMiningResult,
    handleBeginSaltMine,
    handleCreateToken,
    wagmiSigner,
  } = useTokenLaunch();

  if (!effectiveWalletAddress) return null;

  const create2DeployerEnv = (contractAddresses as { CREATE2_DEPLOYER?: string }).CREATE2_DEPLOYER;
  const hasCreate2Deployer =
    create2DeployerEnv && create2DeployerEnv !== '0x0000000000000000000000000000000000000000';

  return (
    <Card className="bg-black border-purple-400/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-white font-libre-caslon flex items-center">
              <Coins className="w-5 h-5 mr-2 text-purple-400" />
              Fixed Supply ERC20 Token Deployment
            </CardTitle>
            <p className="text-sm text-[#DCDDCC] mt-2">
              Deploy a fixed-supply ERC20 token with 1 billion tokens. All tokens are minted to the
              creator on deployment. Uses CREATE2 for vanity address mining.
            </p>
          </div>
          <div className="ml-4">
            {isOnBaseSepolia && (
              <div className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-md">
                <p className="text-xs font-medium text-yellow-400">Base Sepolia</p>
                <p className="text-xs text-yellow-300/70">Testnet (84532)</p>
              </div>
            )}
            {isOnBaseMainnet && (
              <div className="px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-md">
                <p className="text-xs font-medium text-green-400">Base Mainnet</p>
                <p className="text-xs text-green-300/70">Production (8453)</p>
              </div>
            )}
            {!isOnBaseSepolia && !isOnBaseMainnet && (
              <div className="px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-md">
                <p className="text-xs font-medium text-red-400">Unsupported Network</p>
                <p className="text-xs text-red-300/70">Chain ID: {currentChainId}</p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-yellow-500/10 border border-yellow-400/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-400 mb-1">Setup Required</p>
              <p className="text-xs text-[#DCDDCC] mb-2">Before deploying tokens, you need to:</p>
              <ul className="text-xs text-[#DCDDCC] ml-4 list-disc space-y-1">
                <li>Deploy CREATE2Deployer.sol contract and enter its address below</li>
                <li>Compile FixedSupplyERC20.sol and provide the bytecode</li>
              </ul>
              {hasCreate2Deployer && (
                <p className="text-xs text-green-400 mt-2">
                  ✅ CREATE2Deployer address auto-filled for{' '}
                  {isOnBaseSepolia
                    ? 'Base Sepolia'
                    : isOnBaseMainnet
                      ? 'Base Mainnet'
                      : 'current network'}
                </p>
              )}
              {useFactory && fixedSupplyFactory && (
                <p className="text-xs text-cyan-400 mt-2">
                  ⛽ Using FixedSupplyERC20Factory – lower gas (bytecode not sent in tx)
                </p>
              )}
              {!hasCreate2Deployer && (
                <p className="text-xs text-red-400 mt-2">
                  ⚠️ CREATE2Deployer not configured for{' '}
                  {isOnBaseSepolia
                    ? 'Base Sepolia'
                    : isOnBaseMainnet
                      ? 'Base Mainnet'
                      : `Chain ID ${currentChainId}`}
                  . Please enter the address manually.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-[#DCDDCC]">CREATE2Deployer Contract Address *</Label>
            <Input
              value={fixedSupplyDeployment.create2DeployerAddress}
              onChange={(e) =>
                setFixedSupplyDeployment((prev) => ({
                  ...prev,
                  create2DeployerAddress: e.target.value,
                }))
              }
              placeholder="0x..."
              className={`bg-black border-purple-400/20 text-white font-mono mt-2 ${
                deployerValidation.isValid === false
                  ? 'border-red-500'
                  : deployerValidation.isValid === true
                    ? 'border-green-500'
                    : ''
              }`}
            />
            <p className="text-xs text-[#DCDDCC] mt-1">
              Address of the deployed CREATE2Deployer contract
            </p>
            {deployerValidation.isChecking && (
              <div className="mt-2 p-2 bg-blue-500/10 border border-blue-400/20 rounded-md">
                <p className="text-xs text-blue-400 flex items-center">
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  {deployerValidation.message}
                </p>
              </div>
            )}
            {deployerValidation.isValid === true && !deployerValidation.isChecking && (
              <div className="mt-2 p-2 bg-green-500/10 border border-green-400/20 rounded-md">
                <p className="text-xs text-green-400 flex items-center">
                  <CheckCircle className="w-3 h-3 mr-2" />
                  {deployerValidation.message}
                </p>
              </div>
            )}
            {deployerValidation.isValid === false && !deployerValidation.isChecking && (
              <div className="mt-2 p-3 bg-red-500/10 border border-red-400/20 rounded-md">
                <p className="text-xs text-red-400 whitespace-pre-line mb-2">
                  {deployerValidation.message}
                </p>
                {isOnBaseMainnet && (
                  <Button
                    onClick={async () => {
                      try {
                        await switchToChain(SUPPORTED_CHAINS.BASE_SEPOLIA);
                        setChainSwitchFeedback({
                          type: 'success',
                          message: 'Switched to Base Sepolia testnet',
                        });
                      } catch (error) {
                        setChainSwitchFeedback({
                          type: 'error',
                          message: `Failed to switch network: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        });
                      }
                    }}
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs"
                  >
                    Switch to Base Sepolia Testnet
                  </Button>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mt-2 mb-1">
              <Label className="text-[#DCDDCC]">Contract Bytecode *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs border-purple-400/40 text-purple-300 hover:bg-purple-500/20"
                onClick={async () => {
                  try {
                    const r = await fetch('/fixed-supply-bytecode.txt');
                    if (!r.ok) throw new Error('Failed to fetch');
                    const hex = (await r.text()).trim();
                    if (!hex || !hex.startsWith('0x')) throw new Error('Invalid bytecode');
                    setFixedSupplyDeployment((prev) => ({ ...prev, contractBytecode: hex }));
                  } catch (e) {
                    console.error('Load default bytecode:', e);
                    alert(
                      'Could not load default bytecode. Copy from packages/contracts/bytecode/FixedSupplyERC20-bytecode.txt instead.',
                    );
                  }
                }}
              >
                Load default bytecode
              </Button>
            </div>
            <Textarea
              value={fixedSupplyDeployment.contractBytecode}
              onChange={(e) =>
                setFixedSupplyDeployment((prev) => ({
                  ...prev,
                  contractBytecode: e.target.value,
                }))
              }
              placeholder="0x6080604052... or click Load default bytecode"
              className="bg-black border-purple-400/20 text-white font-mono mt-2"
              rows={4}
            />
            <p className="text-xs text-[#DCDDCC] mt-1">
              FixedSupplyERC20 creation bytecode (no constructor args). Same for Base Sepolia & Base
              Mainnet.
            </p>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-400/20 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-purple-400 mb-1 flex items-center">
                <Pickaxe className="w-4 h-4 mr-2" />
                Vanity Address Mining
              </h3>
              <p className="text-xs text-[#DCDDCC]">
                Mine a salt so the token address ends in &quot;ACE&quot; and is lower than the current ACES token address (for Aerodrome pool token0 ordering).
              </p>
            </div>
            <Button
              onClick={handleBeginSaltMine}
              disabled={
                isMining ||
                !effectiveWalletAddress ||
                !wagmiSigner ||
                (!fixedSupplyDeployment.create2DeployerAddress &&
                  !(useFactory && fixedSupplyFactory)) ||
                !fixedSupplyDeployment.contractBytecode
              }
              className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
            >
              {isMining ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mining...
                </>
              ) : (
                <>
                  <Pickaxe className="w-4 h-4 mr-2" />
                  Begin Salt Mine
                </>
              )}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-[#DCDDCC] text-sm">Token Name *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                disabled={isMining}
                className="bg-black border-purple-400/20 text-white"
                placeholder="Token Name"
              />
            </div>
            <div>
              <Label className="text-[#DCDDCC] text-sm">Token Symbol *</Label>
              <Input
                value={createForm.symbol}
                onChange={(e) => setCreateForm((p) => ({ ...p, symbol: e.target.value }))}
                disabled={isMining}
                className="bg-black border-purple-400/20 text-white"
                placeholder="SYMBOL"
              />
            </div>
          </div>
          <div>
            <Label className="text-[#DCDDCC] text-sm">Salt (unique identifier)</Label>
            <Input
              type="text"
              value={createForm.salt}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, salt: e.target.value }))}
              className="bg-black border-purple-400/20 text-white"
              placeholder="Enter unique salt or use 'Begin Salt Mine'"
              disabled={isMining}
            />
            {saltMiningResult && (
              <p className="text-xs text-green-400 mt-1 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" />
                Vanity salt has been applied!
              </p>
            )}
          </div>
          {saltMiningResult && (
            <div className="p-3 bg-green-500/10 border border-green-400/20 rounded-md mt-4">
              <p className="text-xs font-medium text-green-400 mb-1 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Vanity Address Found!
              </p>
              <p className="text-xs text-green-300 break-all font-mono">
                <strong>Address:</strong> {saltMiningResult.predictedAddress}
              </p>
              <p className="text-xs text-green-300">
                <strong>Attempts:</strong> {saltMiningResult.attempts.toLocaleString()} |
                <strong> Time:</strong> {(saltMiningResult.timeElapsed / 1000).toFixed(1)}s
              </p>
            </div>
          )}
          {isMining && (
            <div className="p-4 bg-purple-500/10 border border-purple-400/20 rounded-lg mt-4">
              <h4 className="font-semibold text-purple-400 mb-3 flex items-center">
                <Pickaxe className="w-4 h-4 mr-2" />
                Mining Vanity Address...
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-[#DCDDCC]">
                <div>
                  <span className="text-purple-400">Attempts:</span>{' '}
                  {miningProgress.attempts.toLocaleString()}
                </div>
                <div>
                  <span className="text-purple-400">Time:</span>{' '}
                  {(miningProgress.timeElapsed / 1000).toFixed(1)}s
                </div>
                <div>
                  <span className="text-purple-400">Rate:</span>{' '}
                  {miningProgress.timeElapsed > 0
                    ? (miningProgress.attempts / (miningProgress.timeElapsed / 1000)).toFixed(0)
                    : 0}{' '}
                  attempts/sec
                </div>
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleCreateToken}
          disabled={
            fixedSupplyDeployment.isDeploying ||
            !createForm.name ||
            !createForm.symbol ||
            !createForm.salt ||
            (!fixedSupplyDeployment.create2DeployerAddress &&
              !(useFactory && fixedSupplyFactory)) ||
            !fixedSupplyDeployment.contractBytecode ||
            !effectiveWalletAddress ||
            !wagmiSigner
          }
          className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
        >
          {fixedSupplyDeployment.isDeploying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Deploying Token...
            </>
          ) : (
            <>
              <Coins className="w-4 h-4 mr-2" />
              Create Fixed Supply Token
            </>
          )}
        </Button>

        <div className="p-3 bg-purple-500/5 rounded border border-purple-400/10">
          <p className="text-xs font-medium text-purple-300 mb-1">Token Details:</p>
          <ul className="text-xs text-[#DCDDCC] space-y-1">
            <li>• Total Supply: 1,000,000,000 tokens (1 billion)</li>
            <li>• All tokens are minted to the creator on deployment</li>
            <li>• No additional minting is possible</li>
            <li>• Uses CREATE2 for deterministic address deployment</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
