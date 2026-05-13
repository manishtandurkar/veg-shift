import React, { createContext, useContext, useMemo, useState } from "react";

export interface FarmerProfile {
  desiredCrop: string;
  budgetINR: string;
  landSizeHa: string;
  waterAccess: string;
  irrigationType: string;
  season: string;
}

interface FarmerProfileState {
  profile: FarmerProfile;
  setProfile: (profile: FarmerProfile) => void;
}

const defaultProfile: FarmerProfile = {
  desiredCrop: "",
  budgetINR: "",
  landSizeHa: "",
  waterAccess: "",
  irrigationType: "",
  season: "",
};

const FarmerProfileContext = createContext<FarmerProfileState | undefined>(undefined);

export const FarmerProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<FarmerProfile>(defaultProfile);

  const value = useMemo(() => ({ profile, setProfile }), [profile]);

  return <FarmerProfileContext.Provider value={value}>{children}</FarmerProfileContext.Provider>;
};

export function useFarmerProfile() {
  const ctx = useContext(FarmerProfileContext);
  if (!ctx) {
    throw new Error("useFarmerProfile must be used within FarmerProfileProvider");
  }
  return ctx;
}
