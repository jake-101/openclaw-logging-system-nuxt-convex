/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiDocs from "../apiDocs.js";
import type * as cronRuns from "../cronRuns.js";
import type * as errors from "../errors.js";
import type * as logs from "../logs.js";
import type * as modelUsage from "../modelUsage.js";
import type * as rateLimits from "../rateLimits.js";
import type * as sessions from "../sessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiDocs: typeof apiDocs;
  cronRuns: typeof cronRuns;
  errors: typeof errors;
  logs: typeof logs;
  modelUsage: typeof modelUsage;
  rateLimits: typeof rateLimits;
  sessions: typeof sessions;
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
