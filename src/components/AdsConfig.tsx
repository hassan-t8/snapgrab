"use client";

import { createContext, useContext, type ReactNode } from "react";

/** AdSense IDs from Admin → Integrations, read on the server and handed to every AdSlot. */
type Ads = { client?: string; slot?: string };

const AdsContext = createContext<Ads>({});

export function AdsProvider({ value, children }: { value: Ads; children: ReactNode }) {
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export const useAdsConfig = () => useContext(AdsContext);
