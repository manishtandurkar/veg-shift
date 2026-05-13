export type RiskLevel = "low" | "medium" | "high";

export interface CropScore {
  crop: string;
  score: number;
  season: string;
  zone_match: boolean;
}

export interface CitySummary {
  city: string;
  risk_level: RiskLevel;
  top_crops: CropScore[];
  irrigation: {
    rsi_level: string;
    method: string;
  };
  eri: {
    score: number;
    alert: boolean;
  };
  trend: {
    slope: number;
    trend: string;
  };
  recent_cvle_count: number;
  current_zone?: string;
  evidence_missing?: boolean;
}

export interface EvidenceItem {
  title: string;
  source: string;
  date: string;
  url: string;
  summary: string;
  is_placeholder?: boolean;
}

export interface TransitionRecord {
  city: string;
  transition_year: number;
  from_zone: string;
  to_zone: string;
  years_confirmed: number;
}

export interface TransitionLinkageRecord {
  city: string;
  transition_year: number;
  from_zone: string;
  to_zone: string;
  pre_risk_mean: number;
  post_risk_mean: number;
  risk_delta: number;
  p_value: number | null;
  significant: boolean;
  post_transition_cvle_lag: number | null;
}

export interface CvleEventRecord {
  city: string;
  year: number;
  crop: string;
  koppen_zone: string;
  dual_deficit: number;
  sowing_window_miss: number;
  crop_water_deficit: number;
  gdd_adequate: number;
  depletion_rate: number;
  recharge_efficiency: number;
}

export interface CityDetail {
  advisory: {
    current_zone: string;
    rain_trend_5yr: number;
    temp_trend_5yr: number;
    gw_trend_5yr: number;
    ranked_crops: CropScore[];
  };
  irrigation: {
    rsi_level: string;
    recharge_efficiency: number;
    gw_depth_mbgl: number;
    depletion_rate: number;
    irrigation_method: string;
    avoid_crops: string[];
    recommended_crops: string[];
    optimal_sow_window: string;
    govt_schemes: Record<string, string>;
  };
  eri: {
    eri: number;
    alert: boolean;
    eri_components: Record<string, number>;
    primary_crop: string;
    msp_inr_per_quintal: number | null;
    distress_price_threshold: number | null;
    alternative_crops: string[];
    procurement_center: string;
    crop_insurance_scheme: string;
  };
  transitions: TransitionRecord[];
  transition_linkage: TransitionLinkageRecord[];
  cvle_events: CvleEventRecord[];
  trend: {
    slope: number;
    intercept: number;
    r_squared: number;
    p_value: number;
    trend: string;
  };
  recharge: Record<string, number>;
  shap: {
    city_top: Array<{ feature: string; score: number }>;
    global_top: Array<{ feature: string; score: number }>;
  };
  evidence: EvidenceItem[];
}

export interface MetaInfo {
  version: string;
  last_updated: string;
}

export interface SummaryResponse {
  summary: CitySummary[];
  meta?: MetaInfo;
}
