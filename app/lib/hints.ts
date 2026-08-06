import { CheckIn, LifeEvent, SleepRecord } from "../types";
import { localDateKey } from "./dates";

interface Context {
  todayCheckIns: CheckIn[];
  yesterdaySleep: SleepRecord | null;
  todayEvents: LifeEvent[];
  recentCheckIns: CheckIn[];
  recentEvents: LifeEvent[];
  recentSleep: SleepRecord[];
}

export interface Hint {
  type: "sleep" | "meal" | "caffeine" | "exercise" | "mental" | "general";
  title: string;
  message: string;
  priority: number;
}

function calcSleepHours(bed: string, wake: string): number {
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  const bedMin = bh * 60 + bm;
  let wakeMin = wh * 60 + wm;
  if (wakeMin < bedMin) wakeMin += 24 * 60;
  return (wakeMin - bedMin) / 60;
}

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function clarityAfter(events: LifeEvent[], type: string, hours: number, checkIns: CheckIn[]): number | null {
  const matched = events.filter((e) => e.type === type);
  if (matched.length === 0) return null;

  let total = 0;
  let count = 0;

  matched.forEach((event) => {
    const eventTime = new Date(event.timestamp).getTime();
    const windowEnd = eventTime + hours * 60 * 60 * 1000;
    const related = checkIns.filter((c) => {
      const t = new Date(c.timestamp).getTime();
      return t >= eventTime && t <= windowEnd;
    });
    if (related.length > 0) {
      total += average(related.map((c) => c.scores.clarity));
      count += 1;
    }
  });

  return count > 0 ? total / count : null;
}

function clarityWithout(events: LifeEvent[], type: string, checkIns: CheckIn[]): number | null {
  const eventDates = new Set(
    events.filter((e) => e.type === type).map((e) => localDateKey(e.timestamp))
  );
  const filtered = checkIns.filter((c) => !eventDates.has(localDateKey(c.timestamp)));
  return filtered.length > 0 ? average(filtered.map((c) => c.scores.clarity)) : null;
}

export function generateHints(context: Context): Hint[] {
  const hints: Hint[] = [];
  const { todayCheckIns, yesterdaySleep, todayEvents, recentCheckIns, recentEvents } = context;

  const latestClarity = todayCheckIns.length > 0
    ? average(todayCheckIns.map((c) => c.scores.clarity))
    : null;

  // Sleep hint
  if (yesterdaySleep) {
    const hours = calcSleepHours(yesterdaySleep.bedTime, yesterdaySleep.wakeTime);
    if (hours < 6) {
      hints.push({
        type: "sleep",
        title: "睡眠が短いです",
        message: "6時間未満の睡眠です。午前中は難しいタスクを避け、軽い作業から始めましょう。",
        priority: 10,
      });
    } else if (hours > 9 && yesterdaySleep.quality <= 3) {
      hints.push({
        type: "sleep",
        title: "睡眠の質に注目",
        message: "睡眠時間は長いですが質が高くありません。寝る前のスクリーンタイムや室温を見直してみましょう。",
        priority: 7,
      });
    }
  } else {
    hints.push({
      type: "sleep",
      title: "昨日の睡眠が記録されていません",
      message: "睡眠記録があると、Clarityとの関係が見えてきます。",
      priority: 3,
    });
  }

  // Caffeine hint
  const caffeineHour = todayEvents
    .filter((e) => e.type === "caffeine")
    .map((e) => new Date(e.timestamp).getHours())[0];

  if (caffeineHour !== undefined && caffeineHour >= 14) {
    hints.push({
      type: "caffeine",
      title: "午後のカフェインに注意",
      message: "14時以降のカフェインは睡眠の質を下げ、翌日のClarityに影響する可能性があります。",
      priority: 8,
    });
  }

  if (recentCheckIns.length >= 3) {
    const withCaffeine = clarityAfter(recentEvents, "caffeine", 3, recentCheckIns);
    const withoutCaffeine = clarityWithout(recentEvents, "caffeine", recentCheckIns);
    if (withCaffeine !== null && withoutCaffeine !== null && withCaffeine < withoutCaffeine - 0.3) {
      hints.push({
        type: "caffeine",
        title: "カフェインの影響を確認",
        message: "最近、カフェイン摂取後のClarityが低めです。量やタイミングを変えてみる価値があります。",
        priority: 6,
      });
    }
  }

  // Meal hint
  const hadMealToday = todayEvents.some((e) => e.type === "meal");
  if (recentCheckIns.length >= 3) {
    const withMeal = clarityAfter(recentEvents, "meal", 2, recentCheckIns);
    const withoutMeal = clarityWithout(recentEvents, "meal", recentCheckIns);
    if (withMeal !== null && withoutMeal !== null && withMeal < withoutMeal - 0.3) {
      hints.push({
        type: "meal",
        title: "食後のClarity低下傾向",
        message: "食後の2時間以内にClarityが下がりがちです。昼食を軽めにするか、食後に10分歩くことを試してください。",
        priority: 8,
      });
    }
  }

  if (hadMealToday && latestClarity !== null && latestClarity < 3) {
    hints.push({
      type: "meal",
      title: "午後の眠気対策",
      message: "Clarityが低めです。軽い散歩や水分補給で回復できるかもしれません。",
      priority: 5,
    });
  }

  // Exercise hint
  const hadExerciseToday = todayEvents.some((e) => e.type === "exercise");
  if (!hadExerciseToday && recentCheckIns.length >= 3) {
    const exerciseDays = new Set(
      recentEvents.filter((e) => e.type === "exercise").map((e) => localDateKey(e.timestamp))
    );
    const withExercise = recentCheckIns.filter((c) => exerciseDays.has(localDateKey(c.timestamp)));
    const withoutExercise = recentCheckIns.filter((c) => !exerciseDays.has(localDateKey(c.timestamp)));

    if (withExercise.length > 0 && withoutExercise.length > 0) {
      const avgWith = average(withExercise.map((c) => c.scores.clarity));
      const avgWithout = average(withoutExercise.map((c) => c.scores.clarity));
      if (avgWith > avgWithout + 0.3) {
        hints.push({
          type: "exercise",
          title: "運動がClarity向上に効いています",
          message: "運動した日の方がClarityが高い傾向にあります。今日も軽い運動を試してみませんか？",
          priority: 6,
        });
      }
    }
  }

  // Mental hint
  const latestAnxiety = todayCheckIns.length > 0
    ? average(todayCheckIns.map((c) => c.scores.anxiety))
    : null;
  const latestDiscomfort = todayCheckIns.length > 0
    ? average(todayCheckIns.map((c) => c.scores.discomfort))
    : null;

  if (latestAnxiety !== null && latestAnxiety >= 4) {
    hints.push({
      type: "mental",
      title: "不安レベルが高いです",
      message: "深呼吸や短い散歩で一旦リセットすると、Clarityが戻りやすくなります。",
      priority: 9,
    });
  }

  if (latestDiscomfort !== null && latestDiscomfort >= 4) {
    hints.push({
      type: "mental",
      title: "体調に注意",
      message: "体調不良がClarityを下げている可能性があります。無理せず回復を優先しましょう。",
      priority: 9,
    });
  }

  // General fallback
  if (hints.length === 0 && latestClarity !== null && latestClarity >= 4) {
    hints.push({
      type: "general",
      title: "調子が良さそうです",
      message: "Clarityが高い状態です。重要な作業や創造的なタスクを進めるチャンスです。",
      priority: 2,
    });
  }

  return hints.sort((a, b) => b.priority - a.priority).slice(0, 3);
}
