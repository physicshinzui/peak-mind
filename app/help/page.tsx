"use client";

import { Navigation } from "../components/Navigation";
import { SectionCard } from "../components/SectionCard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function HelpPage() {
  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <header className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft size={16} />
          設定に戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">分析方法について</h1>
        <p className="text-sm text-gray-500">数値の出し方を説明します</p>
      </header>

      <SectionCard title="平均スコア" className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          各日の全チェックインのスコアを平均しています。例えば、朝と昼と夕方にチェックインした場合、その日の頭の冴えは3回の平均値になります。
        </p>
      </SectionCard>

      <SectionCard title="条件付き平均：睡眠時間" className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          各日の睡眠時間を計算し、選択した閾値未満と以上の日に分類します。各グループに含まれる日の全チェックインを対象に、頭の冴えなど各スコアの平均を求めています。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-2">
          睡眠時間は、就寝時刻から起床時刻までの時間差で計算します。例えば23:00就寝・07:00起床の場合は8時間となります。
        </p>
      </SectionCard>

      <SectionCard title="条件付き平均：運動・カフェイン" className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          イベント（運動またはカフェイン）がある日とない日に分類し、各グループに含まれる日の全チェックインを対象に、頭の冴えなど各スコアの平均を求めています。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-2">
          カフェインについては、1日に複数回摂取した場合も「あり」の日としてカウントします。
        </p>
      </SectionCard>

      <SectionCard title="相関" className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          2つの変数が連動しているかをピアソンの相関係数で計算しています。絶対値が0.3を超える場合に「傾向がある」とみなしています。
        </p>
      </SectionCard>

      <SectionCard title="ヒント" className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          過去7日間のデータを対象に、睡眠時間・カフェイン・食事・運動・不調・不安の状態から、現在の状況に応じたアドバイスを生成しています。
        </p>
      </SectionCard>

      <Navigation />
    </main>
  );
}
