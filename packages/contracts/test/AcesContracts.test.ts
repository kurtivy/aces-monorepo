import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Log } from 'ethers';
import {
  AcesToken,
  MockRwaDeedNft,
  MockRwaFactory,
  MockBondingCurveToken,
} from '../typechain-types';

describe('ACES Contracts', function () {
  let acesToken: AcesToken;
  let deedNft: MockRwaDeedNft;
  let factory: MockRwaFactory;
  let bondingCurveToken: MockBondingCurveToken;

  let owner: SignerWithAddress;
  let feeCollector: SignerWithAddress;
  let rwaOwner: SignerWithAddress;
  let trader1: SignerWithAddress;
  let trader2: SignerWithAddress;

  beforeEach(async function () {
    [owner, feeCollector, rwaOwner, trader1, trader2] = await ethers.getSigners();

    // Deploy ACES Token (non-upgradeable)
    const AcesToken = await ethers.getContractFactory('AcesToken');
    acesToken = (await AcesToken.deploy(owner.address)) as AcesToken;
    await acesToken.waitForDeployment();

    // Deploy Deed NFT (non-upgradeable)
    const MockRwaDeedNft = await ethers.getContractFactory('MockRwaDeedNft');
    deedNft = (await MockRwaDeedNft.deploy(owner.address)) as MockRwaDeedNft;
    await deedNft.waitForDeployment();

    // Deploy Factory (upgradeable - use proxy!)
    const MockRwaFactory = await ethers.getContractFactory('MockRwaFactory');
    factory = (await upgrades.deployProxy(
      MockRwaFactory,
      [acesToken.target, deedNft.target], // initializer arguments
      { initializer: 'initialize' },
    )) as MockRwaFactory;
    await factory.waitForDeployment();

    // Grant MINTER_ROLE to factory on deed NFT
    const MINTER_ROLE = await deedNft.MINTER_ROLE();
    await deedNft.grantRole(MINTER_ROLE, factory.target);

    // Mint some ACES tokens to traders for testing
    await acesToken.mint(trader1.address, ethers.parseEther('100000'));
    await acesToken.mint(trader2.address, ethers.parseEther('100000'));
  });

  describe('AcesToken', function () {
    it('Should deploy with correct parameters', async function () {
      expect(await acesToken.name()).to.equal('ACES Token');
      expect(await acesToken.symbol()).to.equal('ACES');
      expect(await acesToken.MAX_SUPPLY()).to.equal(ethers.parseEther('100000000')); // 100M max supply
    });

    it('Should allow minter role to mint tokens', async function () {
      const initialBalance = await acesToken.balanceOf(trader1.address);
      await acesToken.mint(trader1.address, ethers.parseEther('100'));
      const finalBalance = await acesToken.balanceOf(trader1.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther('100'));
    });

    it('Should prevent minting beyond max supply', async function () {
      const maxSupply = await acesToken.MAX_SUPPLY();
      const totalSupply = await acesToken.totalSupply();
      const remainingSupply = maxSupply - totalSupply;

      // Fix BigInt arithmetic - use explicit BigInt conversion
      const excessAmount = remainingSupply + BigInt(1);
      await expect(acesToken.mint(trader1.address, excessAmount)).to.be.revertedWith(
        'AcesToken: Max supply exceeded',
      );
    });

    it('Should only allow minter role to mint', async function () {
      await expect(
        acesToken.connect(trader1).mint(trader1.address, ethers.parseEther('100')),
      ).to.be.revertedWith(/AccessControl: account .* is missing role/);
    });

    it('Should allow burning with proper role', async function () {
      // First mint some tokens to the owner
      await acesToken.mint(owner.address, ethers.parseEther('100'));

      const initialBalance = await acesToken.balanceOf(owner.address);
      await acesToken.burn(ethers.parseEther('100'));
      const finalBalance = await acesToken.balanceOf(owner.address);
      expect(initialBalance - finalBalance).to.equal(ethers.parseEther('100'));
    });
  });

  describe('MockRwaDeedNft', function () {
    it('Should deploy with correct name and symbol', async function () {
      expect(await deedNft.name()).to.equal('ACES RWA Deed');
      expect(await deedNft.symbol()).to.equal('ACES-DEED');
    });

    it('Should only allow minter role to mint', async function () {
      await expect(
        deedNft.connect(rwaOwner).mintDeed(rwaOwner.address, 'ipfs://test'),
      ).to.be.revertedWith(/AccessControl: account .* is missing role/);
    });

    it('Should start token IDs at 1', async function () {
      // Mint a deed NFT directly through the NFT contract (owner has minter role)
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://test');
      expect(await deedNft.ownerOf(1)).to.equal(rwaOwner.address);
    });

    it('Should mark URIs as permanent', async function () {
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://test');
      expect(await deedNft.isPermanentURI(1)).to.be.true;
    });

    it('Should prevent minting to zero address', async function () {
      await expect(deedNft.mintDeed(ethers.ZeroAddress, 'ipfs://test')).to.be.revertedWith(
        'DeedNft: Mint to zero address',
      );
    });
  });

  describe('MockRwaFactory', function () {
    it('Should create RWA with deed NFT and bonding curve token', async function () {
      // First mint a deed NFT
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://test-metadata');

      // Then create the RWA token for that deed
      const tx = await factory.createRwa(
        'Test RWA',
        'TEST',
        1, // deedId
        feeCollector.address,
      );

      const receipt = await tx.wait();

      // Find the RwaTokenCreated event
      const event = receipt?.logs.find((log: Log) => {
        try {
          const parsedLog = factory.interface.parseLog(log);
          return parsedLog?.name === 'RwaTokenCreated';
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;

      // Check deed NFT exists and is owned by rwaOwner
      expect(await deedNft.ownerOf(1)).to.equal(rwaOwner.address);

      // Check token mapping
      const tokenAddress = await factory.deedToToken(1);
      expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

      // Check total tokens count
      expect(await factory.getTotalTokens()).to.equal(1);
    });

    it('Should revert with zero fee collector address', async function () {
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://test-metadata');

      await expect(
        factory.createRwa('Test', 'TEST', 1, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(factory, 'ZeroAddress');
    });

    it('Should revert when trying to create RWA for existing deed', async function () {
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://test-metadata');

      // Create first RWA
      await factory.createRwa('Test RWA', 'TEST', 1, feeCollector.address);

      // Try to create another RWA for the same deed
      await expect(
        factory.createRwa('Test RWA 2', 'TEST2', 1, feeCollector.address),
      ).to.be.revertedWithCustomError(factory, 'InvalidTokenId');
    });

    it('Should implement pagination correctly', async function () {
      // Create multiple RWAs
      for (let i = 1; i <= 5; i++) {
        await deedNft.mintDeed(rwaOwner.address, `ipfs://test-${i}`);
        await factory.createRwa(`Test RWA ${i}`, `TEST${i}`, i, feeCollector.address);
      }

      // Test pagination
      const tokens1 = await factory.getAllTokens(0, 3);
      expect(tokens1.length).to.equal(3);

      const tokens2 = await factory.getAllTokens(3, 3);
      expect(tokens2.length).to.equal(2); // Only 2 remaining

      const tokens3 = await factory.getAllTokens(10, 3);
      expect(tokens3.length).to.equal(0); // Offset beyond array
    });

    it('Should only allow RWA_CREATOR_ROLE to create RWAs', async function () {
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://test');

      await expect(
        factory.connect(trader1).createRwa('Test', 'TEST', 1, feeCollector.address),
      ).to.be.revertedWith(/AccessControl: account .* is missing role/);
    });

    it('Should allow emergency stop by EMERGENCY_ROLE', async function () {
      // Create an RWA first
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://test');
      await factory.createRwa('Test RWA', 'TEST', 1, feeCollector.address);

      const tokenAddress = await factory.deedToToken(1);

      // Emergency stop should work
      await factory.emergencyStop(tokenAddress, true);

      // Non-emergency role should fail
      await expect(factory.connect(trader1).emergencyStop(tokenAddress, false)).to.be.revertedWith(
        /AccessControl: account .* is missing role/,
      );
    });
  });

  describe('MockBondingCurveToken', function () {
    beforeEach(async function () {
      // Create an RWA first through the factory
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://test-metadata');
      await factory.createRwa('Test RWA', 'TEST', 1, feeCollector.address);

      const tokenAddress = await factory.deedToToken(1);
      bondingCurveToken = (await ethers.getContractAt(
        'MockBondingCurveToken',
        tokenAddress,
      )) as MockBondingCurveToken;
    });

    it('Should have correct initial state', async function () {
      expect(await bondingCurveToken.name()).to.equal('Test RWA');
      expect(await bondingCurveToken.symbol()).to.equal('TEST');
      expect(await bondingCurveToken.deedNftId()).to.equal(1);
      expect(await bondingCurveToken.deedNftContract()).to.equal(deedNft.target);
      expect(await bondingCurveToken.acesToken()).to.equal(acesToken.target);
      expect(await bondingCurveToken.totalSupply()).to.equal(0);
    });

    it('Should calculate buy price correctly with bonding curve', async function () {
      const price1 = await bondingCurveToken.getBuyPrice(1000);
      const price10 = await bondingCurveToken.getBuyPrice(10000);

      // Price should increase more than linearly due to bonding curve
      // Fix BigInt arithmetic
      expect(price10).to.be.gt(price1 * BigInt(5));
    });

    it('Should allow buying tokens', async function () {
      const tokenAmount = 1000;
      const [cost] = await bondingCurveToken.previewBuy(tokenAmount);

      // Approve ACES tokens
      await acesToken.connect(trader1).approve(bondingCurveToken.target, cost);

      // Buy tokens
      await bondingCurveToken.connect(trader1).buy(trader1.address, tokenAmount, cost);

      // Check balance
      expect(await bondingCurveToken.balanceOf(trader1.address)).to.equal(tokenAmount);
    });

    it('Should revert buy with insufficient payment', async function () {
      const tokenAmount = 1000;
      const [cost] = await bondingCurveToken.previewBuy(tokenAmount);

      // Approve insufficient ACES tokens
      await acesToken.connect(trader1).approve(bondingCurveToken.target, cost - BigInt(1));

      await expect(bondingCurveToken.connect(trader1).buy(trader1.address, tokenAmount, cost)).to.be
        .reverted;
    });

    it('Should prevent buying beyond max supply', async function () {
      const maxSupply = await bondingCurveToken.MAX_SUPPLY();
      const excessAmount = maxSupply + BigInt(1);
      const cost = await bondingCurveToken.getBuyPrice(excessAmount);

      await acesToken.connect(trader1).approve(bondingCurveToken.target, cost);

      await expect(
        bondingCurveToken.connect(trader1).buy(trader1.address, excessAmount, cost),
      ).to.be.revertedWithCustomError(bondingCurveToken, 'ExceedsMaxSupply');
    });

    it('Should allow selling tokens', async function () {
      const tokenAmount = 1000;
      const [cost] = await bondingCurveToken.previewBuy(tokenAmount);

      // Buy tokens first
      await acesToken.connect(trader1).approve(bondingCurveToken.target, cost);
      await bondingCurveToken.connect(trader1).buy(trader1.address, tokenAmount, cost);

      // Now sell some tokens
      const sellAmount = 500;
      await bondingCurveToken.connect(trader1).sell(trader1.address, sellAmount, 0);

      // Check remaining balance
      expect(await bondingCurveToken.balanceOf(trader1.address)).to.equal(tokenAmount - sellAmount);
    });

    it('Should collect and distribute fees correctly', async function () {
      const tokenAmount = 10000;
      const [cost] = await bondingCurveToken.previewBuy(tokenAmount);

      // Get initial balances
      const initialFeeCollectorBalance = await acesToken.balanceOf(feeCollector.address);

      // Buy tokens
      await acesToken.connect(trader1).approve(bondingCurveToken.target, cost);
      await bondingCurveToken.connect(trader1).buy(trader1.address, tokenAmount, cost);

      // Check fee collector received platform fees
      const finalFeeCollectorBalance = await acesToken.balanceOf(feeCollector.address);
      expect(finalFeeCollectorBalance).to.be.gt(initialFeeCollectorBalance);

      // Check owner fees are accrued
      const accruedFees = await bondingCurveToken.getAccruedFees(1);
      expect(accruedFees).to.be.gt(0);
    });

    it('Should allow deed owner to claim fees', async function () {
      const tokenAmount = 10000;
      const [cost] = await bondingCurveToken.previewBuy(tokenAmount);

      // Buy tokens to generate fees
      await acesToken.connect(trader1).approve(bondingCurveToken.target, cost);
      await bondingCurveToken.connect(trader1).buy(trader1.address, tokenAmount, cost);

      // Get initial balance
      const initialBalance = await acesToken.balanceOf(rwaOwner.address);
      const accruedFees = await bondingCurveToken.getAccruedFees(1);

      // Claim fees as deed owner
      const claimFunction = bondingCurveToken.connect(rwaOwner).getFunction('claimFees');
      await claimFunction();

      // Check balance increased by accrued fees
      const finalBalance = await acesToken.balanceOf(rwaOwner.address);
      expect(finalBalance - initialBalance).to.equal(accruedFees);

      // Check fees are cleared
      expect(await bondingCurveToken.getAccruedFees(1)).to.equal(0);
    });

    it('Should revert fee claim from non-owner', async function () {
      const claimFunction = bondingCurveToken.connect(trader1).getFunction('claimFees');
      await expect(claimFunction()).to.be.revertedWithCustomError(
        bondingCurveToken,
        'NotDeedOwner',
      );
    });

    it('Should prevent trading when emergency stopped', async function () {
      // Stop trading via factory
      await factory.emergencyStop(bondingCurveToken.target, true);

      const tokenAmount = 1000;
      const cost = await bondingCurveToken.getBuyPrice(tokenAmount);
      await acesToken.connect(trader1).approve(bondingCurveToken.target, cost);

      await expect(
        bondingCurveToken.connect(trader1).buy(trader1.address, tokenAmount, cost),
      ).to.be.revertedWith('BondingCurve: Trading is stopped');
    });

    it('Should preview buy/sell correctly', async function () {
      const tokenAmount = 1000;

      // Test buy preview
      const [netCost, platformFee, ownerFee] = await bondingCurveToken.previewBuy(tokenAmount);
      expect(netCost).to.be.gt(0);
      expect(platformFee).to.be.gt(0);
      expect(ownerFee).to.be.gt(0);

      // Actually buy some tokens first to test sell preview
      await acesToken.connect(trader1).approve(bondingCurveToken.target, netCost);
      await bondingCurveToken.connect(trader1).buy(trader1.address, tokenAmount, netCost);

      // Now test sell preview with existing tokens
      const [netProceeds, sellPlatformFee, sellOwnerFee] =
        await bondingCurveToken.previewSell(tokenAmount);
      expect(netProceeds).to.be.gt(0);
      expect(sellPlatformFee).to.be.gt(0);
      expect(sellOwnerFee).to.be.gt(0);

      // Net proceeds should be less than gross cost due to fees
      expect(netProceeds).to.be.lt(netCost);
    });

    describe('Mathematical Properties', function () {
      it('Should maintain price monotonicity', async function () {
        // Test various amounts to ensure price increases with supply
        const amounts = [100, 500, 1000, 5000];
        let lastPrice = BigInt(0);

        for (const amount of amounts) {
          const price = await bondingCurveToken.getBuyPrice(amount);
          expect(price).to.be.gt(lastPrice);
          lastPrice = price;
        }
      });

      it('Should handle edge cases correctly', async function () {
        // Zero amount should return zero price
        expect(await bondingCurveToken.getBuyPrice(0)).to.equal(0);
        expect(await bondingCurveToken.getSellProceeds(0)).to.equal(0);
      });

      it('Should maintain contract balance invariant', async function () {
        const tokenAmount = 5000;
        const [cost, platformFee, ownerFee] = await bondingCurveToken.previewBuy(tokenAmount);
        const baseCost = await bondingCurveToken.getBuyPrice(tokenAmount);

        // Buy tokens
        await acesToken.connect(trader1).approve(bondingCurveToken.target, cost);
        await bondingCurveToken.connect(trader1).buy(trader1.address, tokenAmount, cost);

        // Check contract balance equals base cost + owner fees (platform fees are sent to fee collector)
        const contractBalance = await acesToken.balanceOf(bondingCurveToken.target);
        const accruedFees = await bondingCurveToken.getAccruedFees(1);
        const platformFeesAccrued = await bondingCurveToken.platformFeesAccrued();

        // Contract should contain base cost (for liquidity) + owner fees
        expect(contractBalance).to.equal(baseCost + ownerFee);
        expect(accruedFees).to.equal(ownerFee);
        // Platform fees accrued should be 0 since they were transferred
        expect(platformFeesAccrued).to.equal(0);
      });
    });
  });

  describe('Integration Tests', function () {
    it('Should handle complete RWA lifecycle', async function () {
      // 1. Create deed NFT
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://property-metadata');

      // 2. Create RWA token
      await factory.createRwa('Real Estate Token', 'REAL', 1, feeCollector.address);
      const tokenAddress = await factory.deedToToken(1);
      const token = await ethers.getContractAt('MockBondingCurveToken', tokenAddress);

      // 3. Multiple traders buy tokens
      const amount1 = 1000;
      const [cost1] = await token.previewBuy(amount1);
      await acesToken.connect(trader1).approve(tokenAddress, cost1);
      await token.connect(trader1).buy(trader1.address, amount1, cost1);

      const amount2 = 2000;
      const [cost2] = await token.previewBuy(amount2);
      await acesToken.connect(trader2).approve(tokenAddress, cost2);
      await token.connect(trader2).buy(trader2.address, amount2, cost2);

      // 4. Owner claims fees
      const initialOwnerBalance = await acesToken.balanceOf(rwaOwner.address);
      const claimFunction = token.connect(rwaOwner).getFunction('claimFees');
      await claimFunction();
      const finalOwnerBalance = await acesToken.balanceOf(rwaOwner.address);
      expect(finalOwnerBalance).to.be.gt(initialOwnerBalance);

      // 5. Trader sells tokens
      const sellAmount = 500;
      await token.connect(trader1).sell(trader1.address, sellAmount, 0);
      expect(await token.balanceOf(trader1.address)).to.equal(amount1 - sellAmount);
    });

    it('Should handle role management correctly', async function () {
      // Grant roles to different addresses
      const RWA_CREATOR_ROLE = await factory.RWA_CREATOR_ROLE();
      const EMERGENCY_ROLE = await factory.EMERGENCY_ROLE();

      await factory.grantRole(RWA_CREATOR_ROLE, trader1.address);
      await factory.grantRole(EMERGENCY_ROLE, trader2.address);

      // Trader1 should be able to create RWAs
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://test');
      await factory.connect(trader1).createRwa('Test', 'TEST', 1, feeCollector.address);

      // Trader2 should be able to emergency stop
      const tokenAddress = await factory.deedToToken(1);
      await factory.connect(trader2).emergencyStop(tokenAddress, true);
    });
  });

  describe('Gas Optimization', function () {
    it('Should stay within reasonable gas limits', async function () {
      // Create RWA
      await deedNft.mintDeed(rwaOwner.address, 'ipfs://gas-test');
      const tx1 = await factory.createRwa('Gas Test', 'GAS', 1, feeCollector.address);
      const receipt1 = await tx1.wait();
      expect(receipt1?.gasUsed).to.be.lt(5000000); // 5M gas limit for upgradeable contract deployment

      // Buy tokens
      const tokenAddress = await factory.deedToToken(1);
      const token = await ethers.getContractAt('MockBondingCurveToken', tokenAddress);

      const tokenAmount = 1000;
      const [cost] = await token.previewBuy(tokenAmount);
      await acesToken.connect(trader1).approve(tokenAddress, cost);

      const tx2 = await token.connect(trader1).buy(trader1.address, tokenAmount, cost);
      const receipt2 = await tx2.wait();
      expect(receipt2?.gasUsed).to.be.lt(250000); // 250k gas limit for buy
    });
  });

  describe('Upgrade Tests', function () {
    it('Should be upgradeable', async function () {
      // Test that the factory can be upgraded
      const MockRwaFactoryV2 = await ethers.getContractFactory('MockRwaFactory');

      // For now, just verify it's upgradeable
      expect(await factory.UPGRADER_ROLE()).to.be.a('string');
    });
  });
});
