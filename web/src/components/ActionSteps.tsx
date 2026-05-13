import React from "react";

interface ActionStepsProps {
  irrigationMethod: string;
  sowingWindow: string;
  avoidCrops: string[];
  recommendedCrops: string[];
}

const ActionSteps: React.FC<ActionStepsProps> = ({
  irrigationMethod,
  sowingWindow,
  avoidCrops,
  recommendedCrops,
}) => {
  return (
    <div className="card action-steps">
      <h4>Action Steps</h4>
      <ul>
        <li>Preferred irrigation: {irrigationMethod.replace(/_/g, " ")}</li>
        <li>Optimal sowing window: {sowingWindow}</li>
        <li>Avoid crops: {avoidCrops.length ? avoidCrops.join(", ") : "None"}</li>
        <li>Recommended crops: {recommendedCrops.length ? recommendedCrops.join(", ") : "Review advisory"}</li>
      </ul>
    </div>
  );
};

export default ActionSteps;
