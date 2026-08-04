"use client";

import { Navigation } from "../components/Navigation";
import { SectionCard } from "../components/SectionCard";

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 my-3 text-center font-mono text-sm text-gray-800 overflow-x-auto">
      {children}
    </div>
  );
}

export default function HelpPage() {
  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">分析方法</h1>
        <p className="text-sm text-gray-500">数値の出し方を説明します</p>
      </header>

      <SectionCard title="1. 平均スコア" className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          各日の全チェックインのスコアを算術平均しています。例えば、朝と昼と夕方にチェックインした場合、その日の頭の冴えは3回の平均値になります。
        </p>
        <Formula>
          x̄ = (1/n) Σᵢ xᵢ
        </Formula>
        <p className="text-xs text-gray-500">
          xᵢ: 各チェックインのスコア、n: その日のチェックイン回数
        </p>
      </SectionCard>

      <SectionCard title="2. 条件付き平均：睡眠時間" className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          各日の睡眠時間を計算し、選択した閾値未満と以上の日に分類します。各グループに含まれる日の全チェックインを対象に、各スコアの平均を求めています。
        </p>
        <Formula>
          睡眠時間 = 起床時刻 − 就寝時刻
        </Formula>
        <Formula>
          Clarity&lt;T = mean{'{'}c.scores.clarity | c.date ∈ D&lt;T{'}'}
        </Formula>
        <Formula>
          Clarity≥T = mean{'{'}c.scores.clarity | c.date ∈ D≥T{'}'}
        </Formula>
        <p className="text-xs text-gray-500">
          T: 選択した閾値（時間）、D&lt;T: 睡眠時間がT未満の日の集合、D≥T: T以上の日の集合
        </p>
      </SectionCard>

      <SectionCard title="3. 条件付き平均：運動・カフェイン" className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          イベント（運動またはカフェイン）がある日とない日に分類し、各グループに含まれる日の全チェックインを対象に、各スコアの平均を求めています。
        </p>
        <Formula>
          Score_with = mean{'{'}c.scores.s | c.date ∈ E{'}'}
        </Formula>
        <Formula>
          Score_without = mean{'{'}c.scores.s | c.date ∉ E{'}'}
        </Formula>
        <p className="text-xs text-gray-500">
          E: イベントが記録された日の集合、s: 比較するスコア（clarity など）
        </p>
      </SectionCard>

      <SectionCard title="4. 相関係数" className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          2つの変数が連動しているかをピアソンの相関係数 r で計算しています。絶対値が0.3を超える場合に「傾向がある」とみなしています。
        </p>
        <Formula>
          r = Σ(xᵢ − x̄)(yᵢ − ȳ) / √[Σ(xᵢ − x̄)² Σ(yᵢ − ȳ)²]
        </Formula>
        <p className="text-xs text-gray-500">
          x: 睡眠時間などの説明変数、y: Clarityなどの目的変数
        </p>
      </SectionCard>

      <SectionCard title="5. ヒント" className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          過去7日間のデータを対象に、睡眠時間・カフェイン・食事・運動・不調・不安の状態から、現在の状況に応じたアドバイスを生成しています。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-2">
          例えば、運動した日のClarity平均が運動しなかった日より0.3以上高い場合に「運動を勧める」ヒントを出します。
        </p>
      </SectionCard>

      <Navigation />
    </main>
  );
}
