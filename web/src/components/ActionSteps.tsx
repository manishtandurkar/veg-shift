import React, { useEffect, useMemo, useState } from "react";
import { fetchCoachPlan } from "../api/client";
import type { CoachLanguage, CoachResponse } from "../api/types";
import { useCityContext } from "../state/CityContext";
import { useFarmerProfile } from "../state/FarmerProfileContext";
import { useLanguage } from "../state/LanguageContext";
import { capitalizeWords } from "../utils/text";

interface ActionStepsProps {
  irrigationMethod: string;
  sowingWindow: string;
  avoidCrops: string[];
  recommendedCrops: string[];
}

const LANG_OPTIONS: Record<CoachLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  kn: "ಕನ್ನಡ",
};

const TEXT = {
  en: {
    title: "Action Steps",
    language: "Language",
    specific: "Specific actions",
    aiCoach: "AI Coach",
    aiHint: "Personalized steps using an LLM.",
    generate: "Generate AI plan",
    generating: "Generating AI plan...",
    unavailable: "AI coach unavailable — showing rule-based plan.",
    noCity: "Select a city to generate an AI plan.",
    steps: {
      irrigationCheck: "Confirm water source and set up {method} for this season.",
      irrigationDrip: "For drip: install filters, add a pressure regulator, and check emitters.",
      irrigationSprinkler: "For sprinkler: verify nozzle spacing and account for wind direction.",
      rainwater: "Add rainwater harvesting: rooftop collection plus contour trenches.",
      sowingPlan: "Prepare land and seeds so sowing starts {window}.",
      avoidCrops: "Avoid high-water crops now: {crops}.",
      recommendCrops: "Prioritize these crops: {crops}.",
    },
    method: {
      drip: "drip",
      sprinkler: "sprinkler",
      rwh: "rainwater harvesting",
      or: "or",
      with: "with",
      fallback: "recommended irrigation",
    },
  },
  hi: {
    title: "कार्य योजना",
    language: "भाषा",
    specific: "ठोस कदम",
    aiCoach: "AI सलाहकार",
    aiHint: "LLM से व्यक्तिगत सुझाव।",
    generate: "AI योजना बनाएं",
    generating: "AI योजना बनाई जा रही है...",
    unavailable: "AI सलाहकार उपलब्ध नहीं है — नियम-आधारित योजना दिखा रहे हैं।",
    noCity: "AI योजना के लिए कोई शहर चुनें।",
    steps: {
      irrigationCheck: "अपने जल स्रोत की जांच करें और इस मौसम के लिए {method} व्यवस्था पक्की करें।",
      irrigationDrip: "ड्रिप के लिए: फ़िल्टर, प्रेशर रेगुलेटर लगाएं और एमिटर जांचें।",
      irrigationSprinkler: "स्प्रिंकलर के लिए: नोज़ल दूरी और हवा की दिशा जांचें।",
      rainwater: "बारिश का पानी संग्रह करें: छत से संग्रह + कंटूर ट्रेंच।",
      sowingPlan: "भूमि और बीज की तैयारी करें ताकि बुआई {window} से पहले हो।",
      avoidCrops: "अभी ये फसलें न लगाएं: {crops}.",
      recommendCrops: "इन फसलों को प्राथमिकता दें: {crops}.",
    },
    method: {
      drip: "ड्रिप",
      sprinkler: "स्प्रिंकलर",
      rwh: "वर्षा जल संचयन",
      or: "या",
      with: "के साथ",
      fallback: "अनुशंसित सिंचाई",
    },
  },
  kn: {
    title: "ಕಾರ್ಯ ಕ್ರಮ",
    language: "ಭಾಷೆ",
    specific: "ಸ್ಪಷ್ಟ ಕ್ರಮಗಳು",
    aiCoach: "AI ಸಲಹೆಗಾರ",
    aiHint: "LLM ಮೂಲಕ ವೈಯಕ್ತಿಕ ಸಲಹೆಗಳು.",
    generate: "AI ಯೋಜನೆ ತಯಾರಿಸಿ",
    generating: "AI ಯೋಜನೆ ತಯಾರಲಾಗುತ್ತಿದೆ...",
    unavailable: "AI ಸಲಹೆಗಾರ ಲಭ್ಯವಿಲ್ಲ — ನಿಯಮಾಧಾರಿತ ಯೋಜನೆ ತೋರಿಸಲಾಗುತ್ತಿದೆ.",
    noCity: "AI ಯೋಜನೆಗಾಗಿ ನಗರವನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
    steps: {
      irrigationCheck: "ನಿಮ್ಮ ನೀರಿನ ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಈ ಋತುವಿಗೆ {method} ವ್ಯವಸ್ಥೆ ಖಚಿತಪಡಿಸಿ.",
      irrigationDrip: "ಡ್ರಿಪ್‌ಗೆ: ಫಿಲ್ಟರ್, ಒತ್ತಡ ನಿಯಂತ್ರಕ ಹಾಕಿ ಮತ್ತು ಎಮಿಟರ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.",
      irrigationSprinkler: "ಸ್ಪ್ರಿಂಕ್ಲರ್‌ಗೆ: ನೋಜಲ್ ಅಂತರ ಮತ್ತು ಗಾಳಿ ದಿಕ್ಕನ್ನು ಪರಿಶೀಲಿಸಿ.",
      rainwater: "ಮಳೆ ನೀರು ಸಂಗ್ರಹಣೆ ಮಾಡಿ: ಛಾವಣಿ ಸಂಗ್ರಹ + ಕಂಟೂರು ಟ್ರೆಂಚ್.",
      sowingPlan: "ಭೂಮಿ ಮತ್ತು ಬೀಜ ತಯಾರಿಸಿ; ಬಿತ್ತನೆ {window} ಮುನ್ನ ಮಾಡಿರಿ.",
      avoidCrops: "ಈ ಸಮಯದಲ್ಲಿ ಈ ಬೆಳೆಗಳನ್ನು ತಪ್ಪಿಸಿ: {crops}.",
      recommendCrops: "ಈ ಬೆಳೆಗಳಿಗೆ ಆದ್ಯತೆ ಕೊಡಿ: {crops}.",
    },
    method: {
      drip: "ಡ್ರಿಪ್",
      sprinkler: "ಸ್ಪ್ರಿಂಕ್ಲರ್",
      rwh: "ಮಳೆ ನೀರು ಸಂಗ್ರಹಣೆ",
      or: "ಅಥವಾ",
      with: "ಜೊತೆ",
      fallback: "ಶಿಫಾರಸು ಮಾಡಿದ ನೀರಾವರಿ",
    },
  },
} as const;

function formatList(items: string[]): string {
  return items.length ? items.map(capitalizeWords).join(", ") : "None";
}

function methodLabel(method: string, lang: CoachLanguage): string {
  const t = TEXT[lang].method;
  const hasDrip = method.includes("drip");
  const hasSprinkler = method.includes("sprinkler");
  const hasRwh = method.includes("rwh") || method.includes("rain");

  let base: string = t.fallback;
  if (hasDrip && hasSprinkler) {
    base = `${t.drip} ${t.or} ${t.sprinkler}`;
  } else if (hasDrip) {
    base = t.drip;
  } else if (hasSprinkler) {
    base = t.sprinkler;
  }

  return hasRwh ? `${base} ${t.with} ${t.rwh}` : base;
}

function buildRuleSteps(
  irrigationMethod: string,
  sowingWindow: string,
  avoidCrops: string[],
  recommendedCrops: string[],
  lang: CoachLanguage,
): string[] {
  const t = TEXT[lang].steps;
  const steps: string[] = [];
  const method = methodLabel(irrigationMethod, lang);
  steps.push(t.irrigationCheck.replace("{method}", method));

  if (irrigationMethod.includes("drip")) {
    steps.push(t.irrigationDrip);
  }
  if (irrigationMethod.includes("sprinkler")) {
    steps.push(t.irrigationSprinkler);
  }
  if (irrigationMethod.includes("rwh") || irrigationMethod.includes("rain")) {
    steps.push(t.rainwater);
  }
  if (sowingWindow) {
    steps.push(t.sowingPlan.replace("{window}", sowingWindow));
  }
  if (avoidCrops.length) {
    steps.push(t.avoidCrops.replace("{crops}", formatList(avoidCrops)));
  }
  if (recommendedCrops.length) {
    steps.push(t.recommendCrops.replace("{crops}", formatList(recommendedCrops.slice(0, 5))));
  }
  return steps;
}

const ActionSteps: React.FC<ActionStepsProps> = ({
  irrigationMethod,
  sowingWindow,
  avoidCrops,
  recommendedCrops,
}) => {
  const { selectedCity } = useCityContext();
  const { profile } = useFarmerProfile();
  const [language, setLanguage] = useState<CoachLanguage>("en");
  const { lang: globalLang, setLang } = useLanguage();

  useEffect(() => {
    // sync local coach language with app language on mount
    setLanguage(globalLang as CoachLanguage);
  }, [globalLang]);
  const [coachStatus, setCoachStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [coachResponse, setCoachResponse] = useState<CoachResponse | null>(null);

  const t = TEXT[language];
  const ruleSteps = useMemo(
    () => buildRuleSteps(irrigationMethod, sowingWindow, avoidCrops, recommendedCrops, language),
    [irrigationMethod, sowingWindow, avoidCrops, recommendedCrops, language]
  );

  const paramsKey = useMemo(
    () => JSON.stringify({ irrigationMethod, sowingWindow, avoidCrops, recommendedCrops, profile, selectedCity }),
    [irrigationMethod, sowingWindow, avoidCrops, recommendedCrops, profile, selectedCity]
  );

  useEffect(() => {
    setCoachStatus("idle");
    setCoachResponse(null);
  }, [paramsKey, language]);

  const handleGenerate = async () => {
    if (!selectedCity) {
      setCoachStatus("error");
      return;
    }
    setCoachStatus("loading");
    try {
      const response = await fetchCoachPlan({
        city: selectedCity,
        language,
        irrigation_method: irrigationMethod,
        sowing_window: sowingWindow,
        avoid_crops: avoidCrops,
        recommended_crops: recommendedCrops,
        profile,
      });
      setCoachResponse(response);
      setCoachStatus("ready");
    } catch {
      setCoachStatus("error");
      setCoachResponse(null);
    }
  };

  const coachSteps = coachResponse?.mode === "llm" ? coachResponse.steps : null;
  const coachFallback = coachStatus === "ready" && coachResponse?.mode === "rule-based";

  return (
    <div className="card action-steps">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h4 style={{ margin: 0 }}>{t.title}</h4>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>{t.aiHint}</p>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.75rem", color: "var(--muted)" }}>
          <span>{t.language}</span>
          <select
            value={language}
            onChange={(event) => {
              const v = event.target.value as CoachLanguage;
              setLanguage(v);
              setLang(v);
            }}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--border)" }}
          >
            {Object.entries(LANG_OPTIONS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.specific}</div>
        <ul>
          {ruleSteps.map((step, idx) => (
            <li key={`${idx}-${step.slice(0, 12)}`}>{step}</li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>{t.aiCoach}</div>
          <button
            type="button"
            className="primary"
            onClick={handleGenerate}
            disabled={coachStatus === "loading" || !selectedCity}
            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
          >
            {coachStatus === "loading" ? t.generating : t.generate}
          </button>
        </div>

        {(coachStatus === "error" || coachFallback) && (
          <p style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--muted)" }}>
            {selectedCity ? t.unavailable : t.noCity}
          </p>
        )}

        {coachSteps && (
          <ul style={{ marginTop: 8 }}>
            {coachSteps.map((step, idx) => (
              <li key={`${idx}-${step.slice(0, 12)}`}>{step}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ActionSteps;
