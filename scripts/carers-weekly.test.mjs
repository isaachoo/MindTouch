import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { applyDirectoryRows, applyWebExtractions, digestText, ensureSchema, inferNeeds, parseArgs } from './carers-weekly.mjs';

function database() {
  const db = new DatabaseSync(':memory:');
  ensureSchema(db);
  db.prepare("INSERT INTO runs(run_id, started_at, run_date, status) VALUES(1, '2026-09-01', '2026-09-01', 'running')").run();
  return db;
}

function row(overrides = {}) {
  return {
    unit_id: '100',
    name: '測試長者服務',
    address: '沙田',
    district: '沙田區',
    tel: '2123 4567',
    website: 'https://example.org/',
    detail_url: 'https://www.carers.hk/zh_hk/unit/100',
    categories: '長者 / 社區照顧服務',
    subcategories: '長者 / 社區照顧服務 › 離院支援服務',
    opening_time: '',
    detail_text: 'service evidence',
    source: '照顧者資訊網 carers.hk',
    ...overrides,
  };
}

function addRun(db, runId, date) {
  db.prepare("INSERT INTO runs(run_id, started_at, run_date, status) VALUES(?, ?, ?, 'running')").run(runId, date, date);
}

test('maps directory categories to app needs', () => {
  assert.equal(inferNeeds(row()), 'H03,H11');
});

test('selects independent OpenClaw stages', () => {
  assert.equal(parseArgs(['--directory-only']).stage, 'directory');
  assert.equal(parseArgs(['--watch-only']).stage, 'watch');
  assert.equal(parseArgs(['--publish-only', '--git-publish']).stage, 'publish');
});

test('records add, update, suspected inactive, inactive, and reactivation dates', () => {
  const db = database();
  let counts = applyDirectoryRows(db, [row()], { runId: 1, date: '2026-09-01', missingThreshold: 3, complete: true });
  assert.equal(counts.added, 1);
  assert.equal(db.prepare('SELECT status FROM services').get().status, 'active');

  addRun(db, 2, '2026-09-08');
  counts = applyDirectoryRows(db, [row({ tel: '2987 6543' })], { runId: 2, date: '2026-09-08', missingThreshold: 3, complete: true });
  assert.equal(counts.updated, 1);

  addRun(db, 3, '2026-09-15');
  counts = applyDirectoryRows(db, [], { runId: 3, date: '2026-09-15', missingThreshold: 3, complete: true });
  assert.equal(counts.suspected, 1);
  assert.equal(db.prepare('SELECT status_changed_at FROM services').get().status_changed_at, '2026-09-15');

  addRun(db, 4, '2026-09-22');
  applyDirectoryRows(db, [], { runId: 4, date: '2026-09-22', missingThreshold: 3, complete: true });
  addRun(db, 5, '2026-09-29');
  counts = applyDirectoryRows(db, [], { runId: 5, date: '2026-09-29', missingThreshold: 3, complete: true });
  assert.equal(counts.deactivated, 1);
  const inactive = db.prepare('SELECT status, deactivated_at, missing_runs FROM services').get();
  assert.equal(inactive.status, 'inactive');
  assert.equal(inactive.deactivated_at, '2026-09-29');
  assert.equal(inactive.missing_runs, 3);

  addRun(db, 6, '2026-10-06');
  counts = applyDirectoryRows(db, [row()], { runId: 6, date: '2026-10-06', missingThreshold: 3, complete: true });
  assert.equal(counts.reactivated, 1);
  const reactivated = db.prepare('SELECT status, reactivated_at, deactivated_at, missing_runs FROM services').get();
  assert.equal(reactivated.status, 'active');
  assert.equal(reactivated.reactivated_at, '2026-10-06');
  assert.equal(reactivated.deactivated_at, null);
  assert.equal(reactivated.missing_runs, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM service_status_history').get().n, 4);
  db.close();
});

test('incomplete runs never advance missing status', () => {
  const db = database();
  applyDirectoryRows(db, [row()], { runId: 1, date: '2026-09-01', complete: true });
  addRun(db, 2, '2026-09-08');
  applyDirectoryRows(db, [], { runId: 2, date: '2026-09-08', complete: false });
  const current = db.prepare('SELECT status, missing_runs FROM services').get();
  assert.equal(current.status, 'active');
  assert.equal(current.missing_runs, 0);
  db.close();
});

test('imports only evidence-backed organisation services', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'carers-extract-test-'));
  try {
    const snapshot = path.join(root, 'snapshot.txt');
    writeFileSync(snapshot, '本中心提供長者日間照顧及護老者支援服務。電話 2123 4567。', 'utf8');
    const db = database();
    db.prepare("INSERT INTO sources(source_id,url,kind,first_seen_at) VALUES(7,'https://example.org/services','org_home','2026-09-01')").run();
    const queue = { sources: [{ source_id: 7, snapshot_path: 'snapshot.txt' }] };
    const payload = {
      processed_sources: [7],
      services: [{
        source_id: 7,
        name: '長者日間照顧',
        tel: '2123 4567',
        needs: ['H03'],
        evidence: '本中心提供長者日間照顧及護老者支援服務。',
      }],
    };
    const counts = applyWebExtractions(db, payload, queue, { runId: 1, date: '2026-09-01', repo: root });
    assert.equal(counts.added, 1);
    assert.equal(db.prepare("SELECT status FROM services WHERE source_key LIKE 'org_page:%'").get().status, 'active');
    assert.throws(() => applyWebExtractions(db, {
      processed_sources: [7],
      services: [{ source_id: 7, name: '虛構服務', evidence: '頁面不存在的證據' }],
    }, queue, { runId: 1, date: '2026-09-01', repo: root }), /evidence is missing/u);
    db.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('digest includes every requested count', () => {
  const digest = digestText({
    run_date: '2026-09-28',
    directory: { units: 2450 },
    sources: { registered: 100, attempted: 100, succeeded: 98, unchanged: 90, changed: 3, new: 5, failed: 2, robots_blocked: 1, discovered: 4 },
    services: { added: 8, updated: 13, suspected: 3, deactivated: 2, reactivated: 1, active_total: 2361 },
    errors: [],
    git: { status: 'no_changes' },
  });
  for (const expected of ['Registered: 100', 'Attempted: 100', 'Added: 8', 'Updated: 13', 'Deactivated: 2', 'Active total: 2361']) {
    assert.match(digest, new RegExp(expected));
  }
});
