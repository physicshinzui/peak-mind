"use client";

import { Score1To5, Scores, SCORE_LABELS } from "../types";

interface ScoreInputProps {
  scores: Scores;
  onChange: (scores: Scores) => void;
}

const LABELS: Record<Score1To5, string> = {
  1: "低い",
  2: "やや低い",
  3: "普通",
  4: "やや高い",
  5: "高い",
};

export function ScoreInput({ scores, onChange }: ScoreInputProps) {
  const update = (key: keyof Scores, value: Score1To5) => {
    onChange({ ...scores, [key]: value });
  };

  return (
    <div className="space-y-5">
      {(Object.keys(scores) as (keyof Scores)[]).map((key) => (
        <div key={key}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-gray-800">{SCORE_LABELS[key]}</span>
            <span className="text-sm text-gray-500">{LABELS[scores[key]]}</span>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => update(key, value as Score1To5)}
                className={`flex-1 h-11 rounded-lg text-sm font-semibold transition ${
                  scores[key] === value
                    ? "bg-blue-600 text-white shadow"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
