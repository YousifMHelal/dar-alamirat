"use server";

import { findMatchingBundles as _findMatchingBundles } from "./queries";

/** Server action wrapper so the client order form can call findMatchingBundles. */
export async function findMatchingBundles(variantIds: string[]) {
  return _findMatchingBundles(variantIds);
}
