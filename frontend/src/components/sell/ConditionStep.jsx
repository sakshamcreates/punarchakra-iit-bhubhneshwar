import SectionHeader from "../ui/SectionHeader";
import { getConditionQuestions } from "../../data/sellFlowMockData";

export default function ConditionStep({ category, condition, onConditionChange }) {
  const questions = getConditionQuestions(category);

  return (
    <div className="sell-v2-panel">
      <SectionHeader
        eyebrow="Step 3 · Condition"
        title="Tell us the current condition."
        description="A few quick questions tailored to this device category — this is what the valuation and route decision are built on."
      />

      <div className="sell-v2-question-grid">
        {questions.map((question) => (
          <div className="form-field" key={question.key}>
            <label htmlFor={`cond-${question.key}`}>{question.label}</label>
            <select
              id={`cond-${question.key}`}
              value={condition[question.key] || ""}
              onChange={(event) => onConditionChange(question.key, event.target.value)}
            >
              <option value="">Select one</option>
              {question.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
