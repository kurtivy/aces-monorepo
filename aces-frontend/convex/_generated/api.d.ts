/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as canvasItems from "../canvasItems.js";
import type * as crons from "../crons.js";
import type * as listings from "../listings.js";
import type * as ohlcv from "../ohlcv.js";
import type * as onchainMetrics from "../onchainMetrics.js";
import type * as submissions from "../submissions.js";
import type * as tokenData from "../tokenData.js";
import type * as tokenMetrics from "../tokenMetrics.js";
import type * as tokenSeedData from "../tokenSeedData.js";
import type * as tokens from "../tokens.js";
import type * as tradeInsert from "../tradeInsert.js";
import type * as tradeListener from "../tradeListener.js";
import type * as tradeSyncer from "../tradeSyncer.js";
import type * as trades from "../trades.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  canvasItems: typeof canvasItems;
  crons: typeof crons;
  listings: typeof listings;
  ohlcv: typeof ohlcv;
  onchainMetrics: typeof onchainMetrics;
  submissions: typeof submissions;
  tokenData: typeof tokenData;
  tokenMetrics: typeof tokenMetrics;
  tokenSeedData: typeof tokenSeedData;
  tokens: typeof tokens;
  tradeInsert: typeof tradeInsert;
  tradeListener: typeof tradeListener;
  tradeSyncer: typeof tradeSyncer;
  trades: typeof trades;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
