/**
 * Types for the admin Token Launch page state and forms.
 * Source of truth: useState initial values and handler params in the original page.
 */

export const SKIP_ADMIN_AUTH =
  typeof process.env.NEXT_PUBLIC_SKIP_ADMIN_AUTH !== 'undefined'
    ? process.env.NEXT_PUBLIC_SKIP_ADMIN_AUTH === 'true'
    : true;

export type ListingAssetType =
  | 'VEHICLE'
  | 'JEWELRY'
  | 'COLLECTIBLE'
  | 'ART'
  | 'FASHION'
  | 'ALCOHOL'
  | 'OTHER';

export interface ListingForm {
  title: string;
  symbol: string;
  assetType: ListingAssetType;
  brand: string;
  story: string;
  details: string;
  provenance: string;
  value: string;
  reservePrice: string;
  hypeSentence: string;
  imageGallery: string[];
  location: string;
  assetDetails: Record<string, string>;
  hypePoints: string[];
  startingBidPrice: string;
  launchDate: string;
  tokenId: string;
  showOnCanvas: boolean;
  isFeatured: boolean;
  showOnDrops: boolean;
}

export const INITIAL_LISTING_FORM: ListingForm = {
  title: '',
  symbol: '',
  assetType: 'OTHER',
  brand: '',
  story: '',
  details: '',
  provenance: '',
  value: '',
  reservePrice: '',
  hypeSentence: '',
  imageGallery: [],
  location: '',
  assetDetails: {},
  hypePoints: [],
  startingBidPrice: '',
  launchDate: '',
  tokenId: '',
  showOnCanvas: true,
  isFeatured: false,
  showOnDrops: false,
};

export interface PoolForm {
  tokenAddress: string;
  platformTokenAddress: string;
  stable: boolean;
  tokenAmount: string;
  platformTokenAmount: string;
  lockDuration: string;
  permanentLock: boolean;
  beneficiary: string;
  beneficiaryShare: string;
  bribeableShare: string;
  tickSpacing: string;
  skipSimulation: boolean;
}

export const INITIAL_POOL_FORM: PoolForm = {
  tokenAddress: '0x3C3474f4F616E07733fBc72a016ebD0157dd6ACE',
  platformTokenAddress: '0x55337650856299363c496065C836B9C6E9dE0367',
  stable: false,
  tokenAmount: '10000000',
  platformTokenAmount: '1000',
  lockDuration: '0',
  permanentLock: false,
  beneficiary: '',
  beneficiaryShare: '0',
  bribeableShare: '500',
  tickSpacing: '200',
  skipSimulation: false,
};

export interface FixedSupplyDeployment {
  create2DeployerAddress: string;
  contractBytecode: string;
  isDeploying: boolean;
}

export const INITIAL_FIXED_SUPPLY_DEPLOYMENT: FixedSupplyDeployment = {
  create2DeployerAddress: '',
  contractBytecode: '',
  isDeploying: false,
};

export interface CreateForm {
  name: string;
  symbol: string;
  salt: string;
}

export const INITIAL_CREATE_FORM: CreateForm = {
  name: 'Admin Test Token',
  symbol: 'ATT',
  salt: '',
};

export interface DeployerValidation {
  isValid: boolean | null;
  message: string;
  isChecking: boolean;
}

export const INITIAL_DEPLOYER_VALIDATION: DeployerValidation = {
  isValid: null,
  message: '',
  isChecking: false,
};

export interface MiningProgress {
  attempts: number;
  timeElapsed: number;
  predictedAddress: string;
}

export interface ConfigCheckResult {
  v2Factory: { address: string; hasCode: boolean };
  clFactory: { address: string; hasCode: boolean };
  factoryRegistry: { address: string; hasCode: boolean };
  clPoolLauncher: { address: string; hasCode: boolean };
}

export interface LockerInspectResult {
  owner: string;
  lockedUntil: number;
  lockedUntilDate: string;
  bribeableShare: number;
  beneficiary: string;
  beneficiaryShare: number;
  isLocked: boolean;
}

export interface CreatedToken {
  address: string;
  name: string;
  symbol: string;
}

export interface CreatedListing {
  id: string;
  title: string;
  symbol: string;
  isLive: boolean;
  tokenId: string | null;
}

export interface UnlinkedToken {
  address: string;
  name: string;
  symbol: string;
}

export interface SelectedCanvasItem {
  listingId: string;
  symbol: string;
  title: string;
}

export interface ChainSwitchFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
}
