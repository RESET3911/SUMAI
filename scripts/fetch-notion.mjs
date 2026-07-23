// SUMAI — Notion 賃貸物件DB → data.json 変換スクリプト
// GitHub Actions から実行される。NOTION_TOKEN 環境変数が必要。
// 使い方: node scripts/fetch-notion.mjs

const DATABASE_ID = 'b010a9a252ed4b349490fb95eaabfa5b';
const TOKEN = process.env.NOTION_TOKEN;

if (!TOKEN) {
  console.error('NOTION_TOKEN が設定されていません。既存の data.json をそのまま使います。');
  process.exit(78); // neutral-ish: workflow 側で continue-on-error
}

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

function num(prop) {
  if (!prop) return null;
  if (prop.type === 'number') return prop.number;
  if (prop.type === 'formula' && prop.formula?.type === 'number') return prop.formula.number;
  return null;
}
function text(prop) {
  if (!prop) return '';
  const arr = prop.type === 'title' ? prop.title : prop.type === 'rich_text' ? prop.rich_text : [];
  return (arr || []).map(t => t.plain_text).join('');
}
function checkbox(prop) { return prop?.type === 'checkbox' ? !!prop.checkbox : false; }
function select(prop) { return prop?.type === 'select' ? (prop.select?.name ?? null) : null; }
function url(prop) { return prop?.type === 'url' ? (prop.url ?? null) : null; }

// スコア基準（Notion数式のフォールバック。数式が取れない場合に使用）
// - 家賃の余裕: (26 - 月額合計)×2点（最大20点、マイナスは0）
// - 代官山アクセス: 30分以内→30点、50分以内→15点
// - 立花エリア: +25点
// - 広さ: 面積÷4点（最大20点）
// - 駅徒歩: 5分以内→10点、10分以内→5点
// - 築年数: 10年以内→10点、20年以内→5点
function fallbackScore(p) {
  let s = 0;
  if (p.monthlyTotalMan != null) s += Math.max(0, Math.min(20, (26 - p.monthlyTotalMan) * 2));
  if (p.daikanyamaMin != null) s += p.daikanyamaMin <= 30 ? 30 : p.daikanyamaMin <= 50 ? 15 : 0;
  if (p.tachibana) s += 25;
  if (p.areaSqm != null) s += Math.min(20, p.areaSqm / 4);
  if (p.walkMin != null) s += p.walkMin <= 5 ? 10 : p.walkMin <= 10 ? 5 : 0;
  if (p.ageYears != null) s += p.ageYears <= 10 ? 10 : p.ageYears <= 20 ? 5 : 0;
  return Math.round(s * 10) / 10;
}

async function queryAll() {
  const results = [];
  let cursor = undefined;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!res.ok) {
      throw new Error(`Notion API error ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

const pages = await queryAll();

const properties = pages.map(page => {
  const pr = page.properties;
  const rentMan = num(pr['家賃(万円)']);
  const kanriMan = num(pr['管理費(万円)']);
  let monthlyTotalMan = num(pr['月額合計(万円)']);
  if (monthlyTotalMan == null && (rentMan != null || kanriMan != null)) {
    monthlyTotalMan = Math.round(((rentMan || 0) + (kanriMan || 0)) * 100) / 100;
  }
  const p = {
    id: page.id,
    name: text(pr['物件名']) || '(名称未設定)',
    notionUrl: page.url,
    listingUrl: url(pr['URL']),
    status: select(pr['ステータス']) || '気になる',
    madori: select(pr['間取り']),
    station: text(pr['最寄駅']),
    walkMin: num(pr['駅徒歩(分)']),
    daikanyamaMin: num(pr['代官山まで(分)']),
    rentMan,
    kanriMan,
    monthlyTotalMan,
    areaSqm: num(pr['面積(㎡)']),
    ageYears: num(pr['築年数']),
    pet: checkbox(pr['ペット可']),
    tachibana: checkbox(pr['立花エリア']),
    score: num(pr['スコア']),
    memo: text(pr['メモ']),
    addedAt: pr['追加日']?.created_time || page.created_time,
  };
  if (p.score == null) p.score = fallbackScore(p);
  return p;
});

const out = {
  updatedAt: new Date().toISOString(),
  count: properties.length,
  properties,
};

import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(`data.json を更新しました（${properties.length}件）`);
