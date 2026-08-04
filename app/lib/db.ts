import Dexie, { Table } from "dexie";
import {
  CheckIn,
  LifeEvent,
  SleepRecord,
  Experiment,
  ExperimentLog,
  CognitiveTest,
} from "../types";

class BrainConditionDB extends Dexie {
  checkIns!: Table<CheckIn>;
  events!: Table<LifeEvent>;
  sleepRecords!: Table<SleepRecord>;
  experiments!: Table<Experiment>;
  experimentLogs!: Table<ExperimentLog>;
  cognitiveTests!: Table<CognitiveTest>;

  constructor() {
    super("BrainConditionDB");
    this.version(1).stores({
      checkIns: "id, timestamp, type",
      events: "id, timestamp, type",
      sleepRecords: "id, date",
      experiments: "id, startedAt, status",
      experimentLogs: "id, [experimentId+date], experimentId, date",
      cognitiveTests: "id, timestamp, type",
    });
  }
}

export const db = new BrainConditionDB();

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function getAllTimelineItems(): Promise<
  { id: string; timestamp: string; kind: string; data: unknown }[]
> {
  const [checkIns, events, sleepRecords] = await Promise.all([
    db.checkIns.toArray(),
    db.events.toArray(),
    db.sleepRecords.toArray(),
  ]);

  const items = [
    ...checkIns.map((c) => ({
      id: c.id,
      timestamp: c.timestamp,
      kind: "checkin",
      data: c as unknown,
    })),
    ...events.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      kind: "event",
      data: e as unknown,
    })),
    ...sleepRecords.map((s) => ({
      id: s.id,
      timestamp: `${s.date}T00:00:00.000Z`,
      kind: "sleep",
      data: s as unknown,
    })),
  ];

  return items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
