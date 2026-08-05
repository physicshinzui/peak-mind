export type Score1To5 = 1 | 2 | 3 | 4 | 5;
export type Intensity1To3 = 1 | 2 | 3;

export type CheckInType = "morning" | "noon" | "evening" | "night" | "ad-hoc";

export interface Scores {
  clarity: Score1To5;
  focus: Score1To5;
  mood: Score1To5;
  anxiety: Score1To5;
  decisionFatigue: Score1To5;
  discomfort: Score1To5;
  voiceEase: Score1To5;
}

export const SCORE_LABELS: Record<keyof Scores, string> = {
  clarity: "頭の冴え",
  focus: "集中力",
  mood: "気分",
  anxiety: "不安・緊張",
  decisionFatigue: "意思決定疲労",
  discomfort: "不調",
  voiceEase: "声の出しやすさ",
};

export interface CheckIn {
  id: string;
  timestamp: string;
  type: CheckInType;
  scores: Scores;
  context?: {
    activity?: string;
    location?: string;
    note?: string;
  };
}

export type EventType =
  | "meal"
  | "caffeine"
  | "water"
  | "exercise"
  | "supplement"
  | "break"
  | "nap"
  | "alcohol"
  | "work"
  | "sleep"
  | "discomfort";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meal: "食事",
  caffeine: "カフェイン",
  water: "水分",
  exercise: "運動",
  supplement: "サプリメント",
  break: "休息",
  nap: "昼寝",
  alcohol: "飲酒",
  work: "作業",
  sleep: "睡眠",
  discomfort: "不調",
};

export interface LifeEvent {
  id: string;
  timestamp: string;
  type: EventType;
  detail: {
    label: string;
    amount?: number;
    unit?: string;
    intensity?: Intensity1To3;
  };
  note?: string;
}

export interface SleepRecord {
  id: string;
  date: string;
  bedTime: string;
  wakeTime: string;
  quality: Score1To5;
  awakenings?: number;
}

export type MetricKey = "clarity" | "focus" | "mood" | "anxiety" | "decisionFatigue" | "discomfort" | "sleep";

export interface Experiment {
  id: string;
  name: string;
  description: string;
  startedAt: string;
  endedAt?: string;
  status: "running" | "completed" | "cancelled";
  targetMetrics: MetricKey[];
  dailyCheckItem: string;
  baselineDays: number;
}

export interface ExperimentLog {
  id: string;
  experimentId: string;
  date: string;
  done: boolean;
  note?: string;
}

export interface CognitiveTest {
  id: string;
  timestamp: string;
  type: "reaction";
  score: number;
}

export interface TimelineItem {
  id: string;
  timestamp: string;
  kind: "checkin" | "event" | "sleep" | "experiment" | "test";
  data: CheckIn | LifeEvent | SleepRecord | Experiment | CognitiveTest;
}
