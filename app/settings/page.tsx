"use client";

import { useEffect, useRef, useState } from "react";
import { Navigation } from "../components/Navigation";
import { SectionCard } from "../components/SectionCard";
import { db } from "../lib/db";
import { Download, Upload, Trash2, FileSpreadsheet } from "lucide-react";

export default function SettingsPage() {
  const [counts, setCounts] = useState({ checkIns: 0, events: 0, sleep: 0, experiments: 0 });
  const [imported, setImported] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCounts = async () => {
    const [checkIns, events, sleep, experiments] = await Promise.all([
      db.checkIns.count(),
      db.events.count(),
      db.sleepRecords.count(),
      db.experiments.count(),
    ]);
    setCounts({ checkIns, events, sleep, experiments });
  };

  useEffect(() => {
    loadCounts();
  }, []);

  const handleExport = async () => {
    const data = {
      checkIns: await db.checkIns.toArray(),
      events: await db.events.toArray(),
      sleepRecords: await db.sleepRecords.toArray(),
      experiments: await db.experiments.toArray(),
      experimentLogs: await db.experimentLogs.toArray(),
      cognitiveTests: await db.cognitiveTests.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brain-condition-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (value: unknown): string => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsvCheckIns = async () => {
    const rows = [
      ["id", "timestamp", "type", "clarity", "focus", "mood", "anxiety", "decisionFatigue", "discomfort", "voiceEase", "note"],
      ...(await db.checkIns.toArray()).map((c) => [
        c.id,
        c.timestamp,
        c.type,
        String(c.scores.clarity),
        String(c.scores.focus),
        String(c.scores.mood),
        String(c.scores.anxiety),
        String(c.scores.decisionFatigue),
        String(c.scores.discomfort),
        String(c.scores.voiceEase),
        c.context?.note || "",
      ]),
    ];
    downloadCsv(`peak-mind-checkins-${new Date().toISOString().split("T")[0]}.csv`, rows);
  };

  const handleExportCsvEvents = async () => {
    const rows = [
      ["id", "timestamp", "type", "label", "amount", "unit", "intensity", "medicine", "note"],
      ...(await db.events.toArray()).map((e) => [
        e.id,
        e.timestamp,
        e.type,
        e.detail.label,
        e.detail.amount?.toString() || "",
        e.detail.unit || "",
        e.detail.intensity?.toString() || "",
        e.detail.medicine || "",
        e.note || "",
      ]),
    ];
    downloadCsv(`peak-mind-events-${new Date().toISOString().split("T")[0]}.csv`, rows);
  };

  const handleExportCsvSleep = async () => {
    const rows = [
      ["id", "date", "bedTime", "wakeTime", "quality", "awakenings"],
      ...(await db.sleepRecords.toArray()).map((s) => [
        s.id,
        s.date,
        s.bedTime,
        s.wakeTime,
        String(s.quality),
        s.awakenings?.toString() || "",
      ]),
    ];
    downloadCsv(`peak-mind-sleep-${new Date().toISOString().split("T")[0]}.csv`, rows);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await db.transaction(
        "rw",
        [db.checkIns, db.events, db.sleepRecords, db.experiments, db.experimentLogs, db.cognitiveTests],
        async () => {
          if (data.checkIns) await db.checkIns.bulkPut(data.checkIns);
          if (data.events) await db.events.bulkPut(data.events);
          if (data.sleepRecords) await db.sleepRecords.bulkPut(data.sleepRecords);
          if (data.experiments) await db.experiments.bulkPut(data.experiments);
          if (data.experimentLogs) await db.experimentLogs.bulkPut(data.experimentLogs);
          if (data.cognitiveTests) await db.cognitiveTests.bulkPut(data.cognitiveTests);
        }
      );
      setImported(true);
      loadCounts();
      setTimeout(() => setImported(false), 2000);
    } catch {
      setError("インポートに失敗しました。ファイル形式を確認してください。");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClearAll = async () => {
    if (!confirm("すべてのデータを削除しますか？この操作は元に戻せません。")) return;
    await db.delete();
    window.location.reload();
  };

  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <p className="text-sm text-gray-500">データの管理</p>
      </header>

      <SectionCard title="保存されているデータ">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">チェックイン</p>
            <p className="text-xl font-semibold">{counts.checkIns}件</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">イベント</p>
            <p className="text-xl font-semibold">{counts.events}件</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">睡眠記録</p>
            <p className="text-xl font-semibold">{counts.sleep}件</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">実験</p>
            <p className="text-xl font-semibold">{counts.experiments}件</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="エクスポート" className="mt-4">
        <p className="text-sm text-gray-600 mb-4">
          全データをJSONファイルとして保存できます。定期的なバックアップをおすすめします。
        </p>
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
        >
          <Download size={18} />
          バックアップを保存
        </button>
      </SectionCard>

      <SectionCard title="CSVエクスポート" className="mt-4">
        <p className="text-sm text-gray-600 mb-4">
          スプレッドシートや他のツールで分析できるよう、各データをCSVで保存します。
        </p>
        <div className="space-y-2">
          <button
            onClick={handleExportCsvCheckIns}
            className="flex items-center justify-center gap-2 w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-2.5 rounded-xl transition"
          >
            <FileSpreadsheet size={18} />
            チェックインをCSVで保存
          </button>
          <button
            onClick={handleExportCsvEvents}
            className="flex items-center justify-center gap-2 w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-2.5 rounded-xl transition"
          >
            <FileSpreadsheet size={18} />
            イベントをCSVで保存
          </button>
          <button
            onClick={handleExportCsvSleep}
            className="flex items-center justify-center gap-2 w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-2.5 rounded-xl transition"
          >
            <FileSpreadsheet size={18} />
            睡眠記録をCSVで保存
          </button>
        </div>
      </SectionCard>

      <SectionCard title="インポート" className="mt-4">
        <p className="text-sm text-gray-600 mb-4">
          バックアップファイルからデータを復元します。同じIDのデータは上書きされます。
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-3 rounded-xl transition"
        >
          <Upload size={18} />
          ファイルを読み込む
        </button>
        {imported && (
          <p className="mt-3 text-sm text-green-600 text-center">インポートしました</p>
        )}
        {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}
      </SectionCard>

      <SectionCard title="すべて削除" className="mt-4">
        <p className="text-sm text-gray-600 mb-4">
          ローカルに保存されている全データを削除します。
        </p>
        <button
          onClick={handleClearAll}
          className="flex items-center justify-center gap-2 w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 rounded-xl transition"
        >
          <Trash2 size={18} />
          すべて削除
        </button>
      </SectionCard>

      <div className="mt-6 text-center text-xs text-gray-400">
        <p>Peak Mind</p>
        <p>ローカル保存版</p>
      </div>

      <Navigation />
    </main>
  );
}
