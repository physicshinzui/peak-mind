"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "../components/SectionCard";
import { Navigation } from "../components/Navigation";
import { Experiment, MetricKey, SCORE_LABELS, CheckIn, SleepRecord } from "../types";
import { db, generateId } from "../lib/db";
import { format, parseISO, subDays } from "date-fns";
import { FlaskConical, Plus, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: "clarity", label: SCORE_LABELS.clarity },
  { key: "focus", label: SCORE_LABELS.focus },
  { key: "energy", label: SCORE_LABELS.energy },
  { key: "mood", label: SCORE_LABELS.mood },
  { key: "sleep", label: "睡眠の質" },
];

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

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dailyCheckItem, setDailyCheckItem] = useState("");
  const [baselineDays, setBaselineDays] = useState(7);
  const [targetMetrics, setTargetMetrics] = useState<MetricKey[]>(["clarity", "focus"]);

  const load = async () => {
    const list = await db.experiments.orderBy("startedAt").reverse().toArray();
    setExperiments(list);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleMetric = (key: MetricKey) => {
    setTargetMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const createExperiment = async () => {
    if (!name.trim() || !dailyCheckItem.trim() || targetMetrics.length === 0) return;
    const experiment: Experiment = {
      id: generateId(),
      name,
      description,
      dailyCheckItem,
      baselineDays,
      targetMetrics,
      startedAt: new Date().toISOString(),
      status: "running",
    };
    await db.experiments.add(experiment);
    resetForm();
    setShowForm(false);
    load();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setDailyCheckItem("");
    setBaselineDays(7);
    setTargetMetrics(["clarity", "focus"]);
  };

  const completeExperiment = async (exp: Experiment) => {
    await db.experiments.update(exp.id, { status: "completed", endedAt: new Date().toISOString() });
    load();
    setSelectedExperiment(null);
  };

  const cancelExperiment = async (exp: Experiment) => {
    await db.experiments.update(exp.id, { status: "cancelled", endedAt: new Date().toISOString() });
    load();
    setSelectedExperiment(null);
  };

  const getReport = async (exp: Experiment) => {
    const startDate = parseISO(exp.startedAt);
    const endDate = exp.endedAt ? parseISO(exp.endedAt) : new Date();
    const baselineStart = subDays(startDate, exp.baselineDays);

    const [allCheckIns, allSleep] = await Promise.all([
      db.checkIns.toArray(),
      db.sleepRecords.toArray(),
    ]);

    const baselineCheckIns = allCheckIns.filter(
      (c) => {
        const d = parseISO(c.timestamp);
        return d >= baselineStart && d < startDate;
      }
    );
    const experimentCheckIns = allCheckIns.filter(
      (c) => {
        const d = parseISO(c.timestamp);
        return d >= startDate && d <= endDate;
      }
    );

    const baselineSleep = allSleep.filter(
      (s) => {
        const d = parseISO(s.date);
        return d >= baselineStart && d < startDate;
      }
    );
    const experimentSleep = allSleep.filter(
      (s) => {
        const d = parseISO(s.date);
        return d >= startDate && d <= endDate;
      }
    );

    const metricAvg = (records: CheckIn[], key: MetricKey) => {
      if (key === "sleep") return NaN;
      const values = records.map((r) => r.scores[key]);
      return average(values);
    };

    const sleepAvg = (records: SleepRecord[]) =>
      average(records.map((r) => r.quality));

    return {
      baseline: {
        clarity: metricAvg(baselineCheckIns, "clarity"),
        focus: metricAvg(baselineCheckIns, "focus"),
        energy: metricAvg(baselineCheckIns, "energy"),
        mood: metricAvg(baselineCheckIns, "mood"),
        sleep: sleepAvg(baselineSleep),
        sleepHours: average(
          baselineSleep.map((s) => calcSleepHours(s.bedTime, s.wakeTime))
        ),
      },
      experiment: {
        clarity: metricAvg(experimentCheckIns, "clarity"),
        focus: metricAvg(experimentCheckIns, "focus"),
        energy: metricAvg(experimentCheckIns, "energy"),
        mood: metricAvg(experimentCheckIns, "mood"),
        sleep: sleepAvg(experimentSleep),
        sleepHours: average(
          experimentSleep.map((s) => calcSleepHours(s.bedTime, s.wakeTime))
        ),
      },
    };
  };

  const [reportData, setReportData] = useState<Awaited<ReturnType<typeof getReport>> | null>(null);

  useEffect(() => {
    if (selectedExperiment) {
      getReport(selectedExperiment).then(setReportData);
    }
  }, [selectedExperiment]);

  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">実験</h1>
        <p className="text-sm text-gray-500">ライフスタイルの変更と効果を検証する</p>
      </header>

      <button
        onClick={() => setShowForm(true)}
        className="w-full mb-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
      >
        <Plus size={20} />
        新しい実験を始める
      </button>

      {showForm && (
        <SectionCard title="実験を作成" className="mb-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：朝30分散歩"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">詳細</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                毎日のチェック項目
              </label>
              <input
                type="text"
                value={dailyCheckItem}
                onChange={(e) => setDailyCheckItem(e.target.value)}
                placeholder="例：朝7時に30分散歩する"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ベースライン期間（日）
              </label>
              <input
                type="number"
                min={3}
                max={14}
                value={baselineDays}
                onChange={(e) => setBaselineDays(parseInt(e.target.value) || 7)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                測定する指標
              </label>
              <div className="flex flex-wrap gap-2">
                {METRIC_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleMetric(key)}
                    className={`px-3 py-1.5 rounded-full text-sm transition ${
                      targetMetrics.includes(key)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={createExperiment}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-medium"
              >
                開始
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {selectedExperiment ? (
        <div className="space-y-4">
          <SectionCard title={selectedExperiment.name}>
            <p className="text-sm text-gray-600 mb-3">
              {selectedExperiment.description}
            </p>
            <p className="text-sm font-medium text-gray-700 mb-1">毎日のチェック</p>
            <p className="text-sm text-gray-600 mb-4">
              {selectedExperiment.dailyCheckItem}
            </p>
            <div className="flex gap-2">
              {selectedExperiment.status === "running" && (
                <>
                  <button
                    onClick={() => completeExperiment(selectedExperiment)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-green-100 text-green-700"
                  >
                    <CheckCircle2 size={16} />
                    完了
                  </button>
                  <button
                    onClick={() => cancelExperiment(selectedExperiment)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-red-100 text-red-700"
                  >
                    <XCircle size={16} />
                    中止
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedExperiment(null)}
                className="flex items-center justify-center gap-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
              >
                <RotateCcw size={16} />
                戻る
              </button>
            </div>
          </SectionCard>

          {reportData && (
            <SectionCard title="レポート">
              <div className="space-y-3">
                {selectedExperiment.targetMetrics.map((metric) => {
                  const base = reportData.baseline[metric];
                  const exp = reportData.experiment[metric];
                  const diff = isNaN(base) || isNaN(exp) ? null : exp - base;
                  return (
                    <div key={metric} className="flex justify-between items-center">
                      <span className="text-gray-700">
                        {METRIC_OPTIONS.find((m) => m.key === metric)?.label}
                      </span>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">
                          ベースライン {isNaN(base) ? "-" : base.toFixed(1)}
                        </span>
                        <span className="mx-2 text-gray-300">→</span>
                        <span className="font-semibold text-gray-800">
                          {isNaN(exp) ? "-" : exp.toFixed(1)}
                        </span>
                        {diff !== null && (
                          <span
                            className={`ml-2 text-sm ${
                              diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-500"
                            }`}
                          >
                            {diff > 0 ? "+" : ""}
                            {diff.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {experiments.length === 0 ? (
            <SectionCard>
              <p className="text-sm text-gray-500">
                実験がありません。「新しい実験を始める」から始めてみましょう。
              </p>
            </SectionCard>
          ) : (
            experiments.map((exp) => (
              <button
                key={exp.id}
                onClick={() => setSelectedExperiment(exp)}
                className="w-full text-left"
              >
                <SectionCard>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{exp.name}</p>
                      <p className="text-sm text-gray-600 mt-1">{exp.dailyCheckItem}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {format(parseISO(exp.startedAt), "yyyy/M/d")} 開始
                        {exp.status === "running" && " · 進行中"}
                      </p>
                    </div>
                    <FlaskConical
                      size={20}
                      className={
                        exp.status === "running" ? "text-purple-600" : "text-gray-400"
                      }
                    />
                  </div>
                </SectionCard>
              </button>
            ))
          )}
        </div>
      )}

      <Navigation />
    </main>
  );
}
