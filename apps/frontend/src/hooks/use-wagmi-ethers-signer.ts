'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWalletClient } from 'wagmi';

/**
 * Wagmi-to-Ethers signer hook (Better Privy Smart Wallet support).
 * Converts the Viem wallet client to an ethers Signer and Web3Provider.
 */
export function useWagmiEthersSigner() {
  const { data: walletClient } = useWalletClient();
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);

  useEffect(() => {
    async function getSignerFromWagmi() {
      if (!walletClient) {
        console.log('⏸️ No Wagmi wallet client available');
        setSigner(null);
        setProvider(null);
        return;
      }

      try {
        console.log('🔗 Getting signer from Wagmi wallet client');
        console.log('Wallet client details:', {
          address: walletClient.account.address,
          chainId: walletClient.chain.id,
          chainName: walletClient.chain.name,
        });

        const { chain } = walletClient;
        const network = {
          chainId: chain.id,
          name: chain.name,
        };

        const ethersProvider = new ethers.providers.Web3Provider(
          walletClient.transport as unknown as ethers.providers.ExternalProvider,
          network,
        );

        const ethersSigner = ethersProvider.getSigner();
        const signerAddress = await ethersSigner.getAddress();
        console.log('✅ Wagmi signer obtained and verified:', signerAddress);

        setSigner(ethersSigner);
        setProvider(ethersProvider);
      } catch (error) {
        console.error('❌ Failed to get Wagmi signer:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message);
        }
        setSigner(null);
        setProvider(null);
      }
    }

    getSignerFromWagmi();
  }, [walletClient]);

  return { signer, provider };
}
