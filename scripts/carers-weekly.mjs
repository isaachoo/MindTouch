#!/usr/bin/env node

/**
 * Automatic weekly carers-resource pipeline.
 *
 * - Reads every carers.hk category and, with --details, every unit page.
 * - Maintains dated service state in SQLite.
 * - Watches every registered organisation URL and discovers likely service pages.
 * - Publishes data/carers/published/services.json plus a CSV mirror and run report.
 * - Optionally opens and auto-merges a GitHub PR containing services.json.
 *
 * The script uses only Node.js built-ins so the OpenClaw command job has no
 * Python or npm runtime dependency.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { promises as dns } from 'node:dns';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const DEFAULT_BASE = 'https://www.carers.hk';
const USER_AGENT = 'MindTouch-carer-watch/2.0 (personal use; +https://mt.ohcasi.com/carer/)';
const PAGE_SIZE = 20;

const AUDIENCES = new Map([
  [30, '長者'],
  [31, '照顧者'],
]);

const CATEGORIES = [
  [30, 82, '長者中心／社區計劃'],
  [30, 83, '社區照顧服務'],
  [30, 84, '日間暫託／住宿暫託服務'],
  [30, 85, '院舍服務'],
  [30, 86, '認知障礙症服務'],
  [30, 87, '復康治療及復康器具'],
  [30, 88, '平安鐘服務'],
  [30, 89, '晚期照顧／善終服務'],
  [30, 90, '其他社會資源'],
  [30, 856, '醫療服務資訊'],
  [30, 984, '社區支援單位'],
  [30, 1262, '經濟援助'],
  [31, 91, '照顧者教育及學習'],
  [31, 92, '照顧者互助資源'],
  [31, 93, '熱線服務'],
  [31, 94, '支援照顧者服務'],
  [31, 95, '特定基金／信託服務／經濟援助'],
  [31, 858, '醫療服務資訊'],
  [31, 981, '社區支援單位'],
  [31, 1004, '殮葬資訊'],
  [31, 1185, '緊急救助服務'],
];

const SUBCATEGORIES = [
  [30, 83, 106, '資助家居照顧服務'],
  [30, 83, 107, '自費上門照顧服務'],
  [30, 83, 108, '資助日間照顧中心'],
  [30, 83, 109, '自負盈虧長者日間護理中心'],
  [30, 83, 110, '長者社區照顧服務券'],
  [30, 83, 111, '護送／陪診服務'],
  [30, 83, 112, '離院支援服務'],
  [30, 84, 113, '資助長者日間暫託'],
  [30, 84, 114, '資助長者住宿暫託'],
  [30, 84, 1213, '自費暫託服務'],
  [30, 87, 122, '自費物理治療'],
  [30, 87, 123, '自費職業治療'],
  [30, 87, 124, '自費言語治療'],
  [30, 87, 125, '自費營養師／營養諮詢'],
  [30, 87, 132, '租用／借用復康器具'],
  [30, 87, 1421, '樓梯機借用／租用'],
  [30, 87, 1422, '購買器具'],
  [30, 87, 1423, '輪椅維修'],
  [30, 89, 126, '晚期照顧支援'],
  [30, 89, 127, '晚期院舍療養'],
  [30, 89, 128, '在家離世'],
  [30, 89, 129, '哀傷輔導／殮葬服務'],
  [30, 89, 135, '殮葬經濟支援'],
  [30, 89, 1426, '遺囑／預設醫療指示'],
  [31, 94, 96, '護老者支援'],
  [31, 94, 914, '綜合家庭服務中心'],
  [31, 94, 916, '醫務社工服務'],
  [31, 94, 1019, '地區康健中心／站'],
  [31, 94, 1247, '賽馬會照顧者中心'],
];

const DISTRICTS = new Map([
  [474, '中西區'], [473, '灣仔區'], [527, '東區'], [476, '南區'],
  [479, '油尖旺區'], [477, '深水埗區'], [478, '九龍城區'], [480, '黃大仙區'],
  [482, '觀塘區'], [528, '葵青區'], [529, '荃灣區'], [530, '屯門區'],
  [531, '元朗區'], [532, '北區'], [533, '大埔區'], [534, '沙田區'],
  [481, '西貢區'], [475, '離島區'], [483, '全港'],
]);

const EMPTY_VALUES = new Set(['', 'n/a', 'na', '-', '--', '/', '無', '不適用', 'nil', 'null']);
const SERVICE_LINK_RE = /(elder|elderly|senior|carer|caregiver|respite|home[-_ ]?care|day[-_ ]?care|community[-_ ]?care|service|長者|照顧者|護老|安老|暫託|居家照顧|日間照顧|社區照顧)/iu;
const WATCH_FIELDS = ['name', 'address', 'district', 'tel', 'website', 'detail_url', 'categories', 'subcategories', 'opening_time', 'detail_text'];

function parseArgs(argv) {
  const options = {
    root: path.join(REPO, 'data', 'carers'),
    base: DEFAULT_BASE,
    delayMs: 1000,
    maxPages: 50,
    details: false,
    watchSites: true,
    discoverLinks: true,
    missingThreshold: 3,
    gitPublish: false,
    stage: 'all',
    importFile: '',
    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' }),
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };
    if (arg === '--root') options.root = path.resolve(REPO, next());
    else if (arg === '--base') options.base = next().replace(/\/$/, '');
    else if (arg === '--delay-ms') options.delayMs = Number(next());
    else if (arg === '--max-pages') options.maxPages = Number(next());
    else if (arg === '--missing-threshold') options.missingThreshold = Number(next());
    else if (arg === '--date') options.date = next();
    else if (arg === '--details') options.details = true;
    else if (arg === '--no-details') options.details = false;
    else if (arg === '--skip-sites') options.watchSites = false;
    else if (arg === '--no-discovery') options.discoverLinks = false;
    else if (arg === '--git-publish') options.gitPublish = true;
    else if (arg === '--directory-only') options.stage = 'directory';
    else if (arg === '--watch-only') options.stage = 'watch';
    else if (arg === '--publish-only') options.stage = 'publish';
    else if (arg === '--extract-only') options.stage = 'extract';
    else if (arg === '--import-file') options.importFile = path.resolve(REPO, next());
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) throw new Error('delay must be a non-negative number');
  if (!Number.isInteger(options.maxPages) || options.maxPages < 1) throw new Error('max-pages must be a positive integer');
  if (!Number.isInteger(options.missingThreshold) || options.missingThreshold < 2) throw new Error('missing-threshold must be at least 2');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) throw new Error('date must be YYYY-MM-DD');
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/carers-weekly.mjs [options]

Options:
  --details                 fetch every carers.hk unit page
  --no-details              directory fields only (default)
  --skip-sites              do not check registered organisation pages
  --no-discovery            do not register likely service links from watched pages
  --git-publish             open and auto-merge a GitHub PR with services.json
  --directory-only          refresh carers.hk and service state only
  --watch-only              check registered organisation pages only
  --publish-only            publish existing verified state only
  --extract-only            import evidence-backed organisation-site extraction
  --import-file <path>      strict JSON written by the OpenClaw extraction job
  --root <path>             state/output directory (default data/carers)
  --delay-ms <n>            polite delay between carers.hk requests (default 1000)
  --max-pages <n>           page cap per directory query (default 50)
  --missing-threshold <n>   missed complete runs before inactive (default 3)
  --date <YYYY-MM-DD>       override run date (tests/recovery)
  --base <url>              override carers.hk base URL
`);
}

function clean(value, max = 1000) {
  if (value === null || value === undefined) return '';
  const result = String(value)
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, max);
  return EMPTY_VALUES.has(result.toLowerCase()) ? '' : result;
}

function absolute(value, base) {
  const text = clean(value, 1000);
  if (!text) return '';
  try {
    const url = new URL(text, `${base}/`);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class PoliteClient {
  constructor(delayMs) {
    this.delayMs = delayMs;
    this.lastRequestAt = 0;
    this.requests = 0;
  }

  async wait() {
    const remaining = this.delayMs - (Date.now() - this.lastRequestAt);
    if (remaining > 0) await sleep(remaining);
    this.lastRequestAt = Date.now();
  }

  async request(url, options = {}, retries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      await this.wait();
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json, text/plain, text/html, */*',
            ...(options.headers ?? {}),
          },
          signal: AbortSignal.timeout(20_000),
        });
        this.requests++;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < retries) await sleep(2 ** attempt * 1000);
      }
    }
    throw new Error(`${url}: ${lastError?.message ?? lastError}`);
  }
}

function buildQueries() {
  const mainLabels = new Map(CATEGORIES.map(([audience, type, label]) => [`${audience}/${type}`, label]));
  const main = CATEGORIES.map(([audience, type, label]) => ({ audience, type, subtype: null, label }));
  const sub = SUBCATEGORIES.map(([audience, type, subtype, label]) => ({
    audience,
    type,
    subtype,
    label: `${mainLabels.get(`${audience}/${type}`) ?? type} › ${label}`,
  }));
  return [...main, ...sub];
}

async function queryMapPage(client, base, query, page) {
  const body = new URLSearchParams();
  body.append('aduience[]', String(query.audience));
  body.append('type[]', String(query.type));
  if (query.subtype) body.append('type5[]', String(query.subtype));
  body.append('page', String(page));
  const response = await client.request(`${base}/zh_hk/ajax/map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON directory response: ${text.slice(0, 120)}`);
  }
  if (!Array.isArray(parsed.locations)) throw new Error('Unexpected directory response shape');
  return parsed;
}

function unitId(detailUrl) {
  return /\/unit\/(\d+)/u.exec(detailUrl)?.[1] ?? detailUrl;
}

function locationRow(location, base) {
  const detailUrl = absolute(location.detailUrl, base);
  if (!detailUrl) return null;
  const areaId = clean(location.area, 20);
  return {
    unit_id: unitId(detailUrl),
    name: clean(location.name, 300),
    address: clean(location.address),
    district: clean(location.areaText, 30) || DISTRICTS.get(Number(areaId)) || '',
    tel: clean(location.tel, 100),
    website: absolute(location.url, base),
    tags: Array.isArray(location.tag) ? location.tag.map((item) => clean(item, 50)).filter(Boolean).join('; ') : '',
    opening_time: clean(location.time),
    area_id: areaId,
    audience_ids: clean(location.audience, 50),
    type_ids: clean(location.type, 100),
    lat: location.lat ?? '',
    lng: location.lng ?? '',
    detail_url: detailUrl,
    detail_text: '',
    categories: '',
    category_count: 0,
    subcategories: '',
    subcategory_count: 0,
    source: '照顧者資訊網 carers.hk',
    fetched_at: '',
  };
}

function normalizePage(html) {
  return clean(
    html
      .replace(/<(script|style|noscript|svg|nav|header|footer)[^>]*>[\s\S]*?<\/\1>/giu, ' ')
      .replace(/<!--[\s\S]*?-->/gu, ' '),
    250_000,
  );
}

async function scrapeDirectory(options) {
  const client = new PoliteClient(options.delayMs);
  const queries = buildQueries();
  const units = new Map();
  const memberships = new Map();
  const subMemberships = new Map();
  const fetchedAt = new Date().toISOString();

  for (let index = 0; index < queries.length; index++) {
    const query = queries[index];
    const tag = `${AUDIENCES.get(query.audience)} / ${query.label}`;
    console.error(`[directory ${index + 1}/${queries.length}] ${tag}`);
    const first = await queryMapPage(client, options.base, query, 1);
    const total = Number(first.total || 0);
    const pages = Math.min(options.maxPages, total ? Math.ceil(total / PAGE_SIZE) : 1);
    const locations = [...first.locations];
    for (let page = 2; page <= pages; page++) {
      const result = await queryMapPage(client, options.base, query, page);
      if (result.locations.length === 0) break;
      locations.push(...result.locations);
    }
    for (const location of locations) {
      const row = locationRow(location, options.base);
      if (!row) continue;
      if (!units.has(row.unit_id)) {
        units.set(row.unit_id, row);
        memberships.set(row.unit_id, []);
        subMemberships.set(row.unit_id, []);
      }
      const bucket = query.subtype ? subMemberships.get(row.unit_id) : memberships.get(row.unit_id);
      if (!bucket.includes(tag)) bucket.push(tag);
    }
  }

  const rows = [...units.values()];
  if (options.details) {
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const response = await client.request(row.detail_url);
      row.detail_text = normalizePage(await response.text()).slice(0, 20_000);
      if ((index + 1) % 25 === 0 || index + 1 === rows.length) {
        console.error(`[unit pages] ${index + 1}/${rows.length}`);
      }
    }
  }

  for (const row of rows) {
    row.categories = memberships.get(row.unit_id).join(' | ');
    row.category_count = memberships.get(row.unit_id).length;
    row.subcategories = subMemberships.get(row.unit_id).join(' | ');
    row.subcategory_count = subMemberships.get(row.unit_id).length;
    row.fetched_at = fetchedAt;
  }
  rows.sort((a, b) => String(a.unit_id).localeCompare(String(b.unit_id), 'en', { numeric: true }));
  if (rows.length === 0) throw new Error('The complete directory scrape returned zero services');
  return { rows, requests: client.requests, queries: queries.length };
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function rowsToCsv(rows, columns) {
  const lines = [columns.map(csvEscape).join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

function ensureSchema(db) {
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS services (
      service_id INTEGER PRIMARY KEY,
      source_key TEXT UNIQUE NOT NULL,
      carers_unit_id TEXT UNIQUE,
      name TEXT NOT NULL,
      address TEXT, district TEXT, tel TEXT, website TEXT, detail_url TEXT,
      categories TEXT, subcategories TEXT, needs TEXT, opening_time TEXT, detail_text TEXT,
      source TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active','suspected_inactive','inactive')) DEFAULT 'active',
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT,
      last_verified_at TEXT,
      status_changed_at TEXT NOT NULL,
      deactivated_at TEXT,
      reactivated_at TEXT,
      missing_runs INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS service_status_history (
      history_id INTEGER PRIMARY KEY,
      service_id INTEGER NOT NULL REFERENCES services(service_id),
      run_id INTEGER,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      reason TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS changes (
      change_id INTEGER PRIMARY KEY,
      run_id INTEGER,
      service_id INTEGER,
      kind TEXT NOT NULL CHECK(kind IN ('add','update','suspect','deactivate','reactivate')),
      payload_json TEXT NOT NULL,
      evidence_url TEXT,
      evidence_excerpt TEXT,
      evidence_hash TEXT,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sources (
      source_id INTEGER PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('org_home','discovered_page','pdf')),
      active INTEGER NOT NULL DEFAULT 1,
      discovered_from TEXT,
      first_seen_at TEXT NOT NULL,
      last_fetched_at TEXT,
      last_changed_at TEXT,
      last_hash TEXT,
      last_status INTEGER,
      content_type TEXT,
      fail_count INTEGER NOT NULL DEFAULT 0,
      needs_review INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS runs (
      run_id INTEGER PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      run_date TEXT NOT NULL,
      status TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'all',
      directory_units INTEGER DEFAULT 0,
      directory_requests INTEGER DEFAULT 0,
      sources_registered INTEGER DEFAULT 0,
      sources_attempted INTEGER DEFAULT 0,
      sources_succeeded INTEGER DEFAULT 0,
      sources_unchanged INTEGER DEFAULT 0,
      sources_changed INTEGER DEFAULT 0,
      sources_new INTEGER DEFAULT 0,
      sources_failed INTEGER DEFAULT 0,
      sources_robots_blocked INTEGER DEFAULT 0,
      sources_discovered INTEGER DEFAULT 0,
      services_added INTEGER DEFAULT 0,
      services_updated INTEGER DEFAULT 0,
      services_suspected INTEGER DEFAULT 0,
      services_deactivated INTEGER DEFAULT 0,
      services_reactivated INTEGER DEFAULT 0,
      active_total INTEGER DEFAULT 0,
      errors_json TEXT DEFAULT '[]',
      git_json TEXT DEFAULT '{}'
    );
  `);
  const runColumns = new Set(db.prepare('PRAGMA table_info(runs)').all().map((row) => row.name));
  if (!runColumns.has('stage')) db.exec("ALTER TABLE runs ADD COLUMN stage TEXT NOT NULL DEFAULT 'all'");
  const changeColumns = new Set(db.prepare('PRAGMA table_info(changes)').all().map((row) => row.name));
  if (!changeColumns.has('evidence_excerpt')) db.exec('ALTER TABLE changes ADD COLUMN evidence_excerpt TEXT');
  if (!changeColumns.has('evidence_hash')) db.exec('ALTER TABLE changes ADD COLUMN evidence_hash TEXT');
}

function inferNeeds(row) {
  const text = `${row.categories ?? ''} | ${row.subcategories ?? ''}`;
  const rules = [
    ['H01', /醫療服務資訊|社區支援單位|認知障礙症服務/u],
    ['H02', /照顧者教育及學習/u],
    ['H03', /社區照顧服務/u],
    ['H04', /暫託/u],
    ['H05', /經濟援助|基金|信託/u],
    ['H06', /照顧者互助|支援照顧者|熱線服務/u],
    ['H07', /綜合家庭服務中心|護老者支援/u],
    ['H08', /社區支援單位|支援照顧者/u],
    ['H09', /復康治療|復康器具|平安鐘|護送|陪診/u],
    ['H10', /院舍服務|護老者支援|遺囑|預設醫療指示/u],
    ['H11', /離院支援|暫託|支援照顧者/u],
    ['H12', /晚期照顧|善終|殮葬/u],
  ];
  return rules.filter(([, pattern]) => pattern.test(text)).map(([need]) => need).join(',');
}

function recordChange(db, runId, serviceId, kind, payload, evidenceUrl, date, evidenceExcerpt = '', evidenceHash = '') {
  db.prepare(`INSERT INTO changes(run_id, service_id, kind, payload_json, evidence_url,
                                  evidence_excerpt, evidence_hash, applied_at)
              VALUES(?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(runId, serviceId, kind, JSON.stringify(payload), evidenceUrl || null,
      evidenceExcerpt || null, evidenceHash || null, date);
}

function recordStatus(db, runId, serviceId, oldStatus, newStatus, date, reason) {
  db.prepare(`INSERT INTO service_status_history(service_id, run_id, old_status, new_status, changed_at, reason)
              VALUES(?, ?, ?, ?, ?, ?)`)
    .run(serviceId, runId, oldStatus, newStatus, date, reason);
}

function applyDirectoryRows(db, rows, { runId, date, missingThreshold = 3, complete = true }) {
  const counts = { added: 0, updated: 0, suspected: 0, deactivated: 0, reactivated: 0 };
  const select = db.prepare('SELECT * FROM services WHERE source_key=?');
  const insert = db.prepare(`INSERT INTO services(
      source_key, carers_unit_id, name, address, district, tel, website, detail_url,
      categories, subcategories, needs, opening_time, detail_text, source, status,
      first_seen_at, last_seen_at, last_verified_at, status_changed_at, updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const update = db.prepare(`UPDATE services SET
      name=?, address=?, district=?, tel=?, website=?, detail_url=?, categories=?, subcategories=?, needs=?,
      opening_time=?, detail_text=?, last_seen_at=?, last_verified_at=?, missing_runs=0,
      status=?, status_changed_at=?, deactivated_at=?, reactivated_at=?, updated_at=?
    WHERE service_id=?`);
  const seen = new Set();

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const key = `carers_hk:${row.unit_id}`;
      seen.add(key);
      const values = {
        name: row.name,
        address: row.address,
        district: row.district,
        tel: row.tel,
        website: row.website,
        detail_url: row.detail_url,
        categories: row.categories,
        subcategories: row.subcategories,
        needs: inferNeeds(row),
        opening_time: row.opening_time,
        detail_text: row.detail_text,
      };
      const existing = select.get(key);
      if (!existing) {
        const result = insert.run(
          key, row.unit_id, values.name, values.address, values.district, values.tel, values.website,
          values.detail_url, values.categories, values.subcategories, values.needs, values.opening_time,
          values.detail_text, row.source, 'active', date, date, date, date, date,
        );
        const serviceId = Number(result.lastInsertRowid);
        recordStatus(db, runId, serviceId, null, 'active', date, 'First observed in a complete carers.hk export');
        recordChange(db, runId, serviceId, 'add', values, row.detail_url, date);
        counts.added++;
        continue;
      }

      const fieldChanges = {};
      for (const field of WATCH_FIELDS) {
        const oldValue = existing[field] ?? '';
        const newValue = values[field] ?? '';
        if (String(oldValue) !== String(newValue)) fieldChanges[field] = { old: oldValue, new: newValue };
      }
      let status = existing.status;
      let statusChangedAt = existing.status_changed_at;
      let deactivatedAt = existing.deactivated_at;
      let reactivatedAt = existing.reactivated_at;
      if (existing.status !== 'active') {
        const oldStatus = existing.status;
        status = 'active';
        statusChangedAt = date;
        deactivatedAt = null;
        reactivatedAt = date;
        recordStatus(db, runId, existing.service_id, oldStatus, 'active', date, 'Service reappeared in carers.hk');
        recordChange(db, runId, existing.service_id, 'reactivate', { old_status: oldStatus, new_status: 'active' }, row.detail_url, date);
        counts.reactivated++;
      }
      update.run(
        values.name, values.address, values.district, values.tel, values.website, values.detail_url,
        values.categories, values.subcategories, values.needs, values.opening_time, values.detail_text,
        date, date, status, statusChangedAt, deactivatedAt, reactivatedAt, date, existing.service_id,
      );
      if (Object.keys(fieldChanges).length > 0) {
        recordChange(db, runId, existing.service_id, 'update', fieldChanges, row.detail_url, date);
        counts.updated++;
      }
    }

    if (complete) {
      const existingRows = db.prepare("SELECT * FROM services WHERE source='\u7167\u9867\u8005\u8cc7\u8a0a\u7db2 carers.hk'").all();
      const markMissing = db.prepare(`UPDATE services SET status=?, status_changed_at=?, deactivated_at=?,
                                      missing_runs=?, updated_at=? WHERE service_id=?`);
      for (const existing of existingRows) {
        if (seen.has(existing.source_key)) continue;
        const missingRuns = Number(existing.missing_runs) + 1;
        if (existing.status === 'active') {
          markMissing.run('suspected_inactive', date, existing.deactivated_at, missingRuns, date, existing.service_id);
          recordStatus(db, runId, existing.service_id, 'active', 'suspected_inactive', date, 'Missing from the first complete weekly export');
          recordChange(db, runId, existing.service_id, 'suspect', { missing_runs: missingRuns }, existing.detail_url, date);
          counts.suspected++;
        } else if (existing.status === 'suspected_inactive' && missingRuns >= missingThreshold) {
          markMissing.run('inactive', date, date, missingRuns, date, existing.service_id);
          recordStatus(db, runId, existing.service_id, 'suspected_inactive', 'inactive', date, `Missing from ${missingRuns} consecutive complete weekly exports`);
          recordChange(db, runId, existing.service_id, 'deactivate', { missing_runs: missingRuns }, existing.detail_url, date);
          counts.deactivated++;
        } else {
          markMissing.run(existing.status, existing.status_changed_at, existing.deactivated_at, missingRuns, date, existing.service_id);
        }
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return counts;
}

function webServiceKey(sourceId, name) {
  const normalized = clean(name, 300).toLocaleLowerCase('zh-HK');
  return `org_page:${sourceId}:${createHash('sha256').update(normalized).digest('hex').slice(0, 20)}`;
}

function applyWebExtractions(db, payload, queue, { runId, date, missingThreshold = 3, repo = REPO }) {
  if (!payload || !Array.isArray(payload.processed_sources) || !Array.isArray(payload.services)) {
    throw new Error('Extraction JSON must contain processed_sources and services arrays');
  }
  const queued = new Map((queue.sources ?? []).map((item) => [Number(item.source_id), item]));
  const processed = [...new Set(payload.processed_sources.map(Number))];
  if (processed.some((sourceId) => !Number.isInteger(sourceId) || !queued.has(sourceId))) {
    throw new Error('Extraction references a source that is not in the current changed-source queue');
  }
  const sourceRows = new Map(db.prepare('SELECT source_id, url FROM sources').all().map((row) => [Number(row.source_id), row]));
  const snapshots = new Map();
  for (const sourceId of processed) {
    const item = queued.get(sourceId);
    if (!item.snapshot_path || !item.snapshot_path.toLowerCase().endsWith('.txt')) {
      snapshots.set(sourceId, '');
      continue;
    }
    snapshots.set(sourceId, clean(readFileSync(path.resolve(repo, item.snapshot_path), 'utf8'), 250_000));
  }

  const counts = { added: 0, updated: 0, suspected: 0, deactivated: 0, reactivated: 0 };
  const seenBySource = new Map(processed.map((sourceId) => [sourceId, new Set()]));
  const select = db.prepare('SELECT * FROM services WHERE source_key=?');
  const insert = db.prepare(`INSERT INTO services(
      source_key, carers_unit_id, name, address, district, tel, website, detail_url,
      categories, subcategories, needs, opening_time, detail_text, source, status,
      first_seen_at, last_seen_at, last_verified_at, status_changed_at, updated_at
    ) VALUES(?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const update = db.prepare(`UPDATE services SET name=?, address=?, district=?, tel=?, website=?, detail_url=?,
      needs=?, opening_time=?, detail_text=?, status=?, last_seen_at=?, last_verified_at=?, status_changed_at=?,
      deactivated_at=?, reactivated_at=?, missing_runs=0, updated_at=? WHERE service_id=?`);
  const allowedNeeds = new Set(Array.from({ length: 12 }, (_, index) => `H${String(index + 1).padStart(2, '0')}`));

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const item of payload.services) {
      const sourceId = Number(item.source_id);
      if (!seenBySource.has(sourceId)) throw new Error(`Service references unprocessed source ${item.source_id}`);
      const name = clean(item.name, 300);
      const evidence = clean(item.evidence, 500);
      const snapshot = snapshots.get(sourceId);
      if (!name || !evidence || !snapshot || !snapshot.includes(evidence)) {
        throw new Error(`Service evidence is missing from source ${sourceId}: ${name || '(unnamed)'}`);
      }
      const sourceRow = sourceRows.get(sourceId);
      const key = webServiceKey(sourceId, name);
      seenBySource.get(sourceId).add(key);
      const needs = (Array.isArray(item.needs) ? item.needs : String(item.needs ?? '').split(','))
        .map((value) => clean(value, 3).toUpperCase()).filter((value) => allowedNeeds.has(value));
      const detailUrl = normalizeSourceUrl(item.url) || sourceRow.url;
      const website = normalizeSourceUrl(item.website) || new URL(sourceRow.url).origin;
      const values = {
        name,
        address: clean(item.address),
        district: clean(item.district, 30),
        tel: clean(item.tel, 100),
        website,
        detail_url: detailUrl,
        needs: [...new Set(needs)].join(','),
        opening_time: clean(item.opening_time),
        detail_text: evidence,
      };
      const evidenceHash = createHash('sha256').update(evidence).digest('hex');
      const existing = select.get(key);
      if (!existing) {
        const result = insert.run(
          key, values.name, values.address, values.district, values.tel, values.website, values.detail_url,
          '', '', values.needs, values.opening_time, values.detail_text, `機構網站 ${new URL(sourceRow.url).hostname}`,
          'active', date, date, date, date, date,
        );
        const serviceId = Number(result.lastInsertRowid);
        recordStatus(db, runId, serviceId, null, 'active', date, 'Evidence-backed service found on an organisation website');
        recordChange(db, runId, serviceId, 'add', values, sourceRow.url, date, evidence, evidenceHash);
        counts.added++;
        continue;
      }
      const fieldChanges = {};
      for (const [field, newValue] of Object.entries(values)) {
        if (String(existing[field] ?? '') !== String(newValue ?? '')) fieldChanges[field] = { old: existing[field] ?? '', new: newValue };
      }
      let status = existing.status;
      let statusChangedAt = existing.status_changed_at;
      let deactivatedAt = existing.deactivated_at;
      let reactivatedAt = existing.reactivated_at;
      if (status !== 'active') {
        const oldStatus = status;
        status = 'active';
        statusChangedAt = date;
        deactivatedAt = null;
        reactivatedAt = date;
        recordStatus(db, runId, existing.service_id, oldStatus, status, date, 'Service evidence reappeared on organisation website');
        recordChange(db, runId, existing.service_id, 'reactivate', { old_status: oldStatus, new_status: status }, sourceRow.url, date, evidence, evidenceHash);
        counts.reactivated++;
      }
      update.run(values.name, values.address, values.district, values.tel, values.website, values.detail_url,
        values.needs, values.opening_time, values.detail_text, status, date, date, statusChangedAt,
        deactivatedAt, reactivatedAt, date, existing.service_id);
      if (Object.keys(fieldChanges).length) {
        recordChange(db, runId, existing.service_id, 'update', fieldChanges, sourceRow.url, date, evidence, evidenceHash);
        counts.updated++;
      }
    }

    const markMissing = db.prepare(`UPDATE services SET status=?, status_changed_at=?, deactivated_at=?,
                                    missing_runs=?, updated_at=? WHERE service_id=?`);
    for (const sourceId of processed) {
      const prefix = `org_page:${sourceId}:`;
      for (const existing of db.prepare('SELECT * FROM services WHERE substr(source_key, 1, ?)=?').all(prefix.length, prefix)) {
        if (seenBySource.get(sourceId).has(existing.source_key)) continue;
        const missingRuns = Number(existing.missing_runs) + 1;
        if (existing.status === 'active') {
          markMissing.run('suspected_inactive', date, existing.deactivated_at, missingRuns, date, existing.service_id);
          recordStatus(db, runId, existing.service_id, 'active', 'suspected_inactive', date, 'Evidence absent after organisation page changed');
          recordChange(db, runId, existing.service_id, 'suspect', { missing_runs: missingRuns }, sourceRows.get(sourceId).url, date);
          counts.suspected++;
        } else if (existing.status === 'suspected_inactive' && missingRuns >= missingThreshold) {
          markMissing.run('inactive', date, date, missingRuns, date, existing.service_id);
          recordStatus(db, runId, existing.service_id, 'suspected_inactive', 'inactive', date, `Evidence absent from ${missingRuns} changed-page extractions`);
          recordChange(db, runId, existing.service_id, 'deactivate', { missing_runs: missingRuns }, sourceRows.get(sourceId).url, date);
          counts.deactivated++;
        } else {
          markMissing.run(existing.status, existing.status_changed_at, existing.deactivated_at, missingRuns, date, existing.service_id);
        }
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return counts;
}

function normalizeSourceUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function seedSources(db, rows, date) {
  const insert = db.prepare(`INSERT OR IGNORE INTO sources(url, kind, first_seen_at) VALUES(?, 'org_home', ?)`);
  let added = 0;
  for (const row of rows) {
    const url = normalizeSourceUrl(row.website);
    if (!url) continue;
    const result = insert.run(url, date);
    added += Number(result.changes || 0);
  }
  return added;
}

function isPrivateAddress(address) {
  if (address === '::1' || address === '0.0.0.0' || address === '::') return true;
  if (address.includes(':')) {
    const lower = address.toLowerCase();
    return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:') || lower.startsWith('::ffff:127.');
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || parts[0] === 0;
}

async function assertPublicUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
  if (url.username || url.password) throw new Error('credentials in URL are not allowed');
  const hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
  if (hostname === 'localhost' || hostname.endsWith('.local')) throw new Error('local host is not allowed');
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('private address is not allowed');
  } else {
    const results = await dns.lookup(hostname, { all: true });
    if (results.length === 0 || results.some((item) => isPrivateAddress(item.address))) {
      throw new Error('private or unresolved destination is not allowed');
    }
  }
  return url;
}

async function safeFetch(value, { timeoutMs = 20_000, maxBytes = 5_000_000 } = {}) {
  let url = await assertPublicUrl(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain,application/pdf,*/*' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`redirect ${response.status} without location`);
      url = await assertPublicUrl(new URL(location, url).href);
      continue;
    }
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > maxBytes) throw new Error(`response exceeds ${maxBytes} bytes`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > maxBytes) throw new Error(`response exceeds ${maxBytes} bytes`);
    return { response, body, finalUrl: url.href };
  }
  throw new Error('too many redirects');
}

function robotsAllows(text, pathname) {
  let applies = false;
  const disallows = [];
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.replace(/#.*/u, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') applies = value === '*';
    else if (applies && key === 'disallow' && value) disallows.push(value);
  }
  return !disallows.some((rule) => pathname.startsWith(rule));
}

async function canFetchByRobots(url, cache) {
  const parsed = new URL(url);
  const origin = parsed.origin;
  if (!cache.has(origin)) {
    try {
      const { response, body } = await safeFetch(`${origin}/robots.txt`, { timeoutMs: 10_000, maxBytes: 500_000 });
      cache.set(origin, response.ok ? body.toString('utf8') : '');
    } catch {
      cache.set(origin, '');
    }
  }
  return robotsAllows(cache.get(origin), parsed.pathname || '/');
}

function discoverServiceLinks(html, pageUrl) {
  const base = new URL(pageUrl);
  const found = new Set();
  const pattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/giu;
  let match;
  while ((match = pattern.exec(html)) && found.size < 10) {
    const raw = (match[1] || match[2] || match[3] || '').replaceAll('&amp;', '&');
    try {
      const url = new URL(raw, base);
      if (url.origin !== base.origin || !['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      if (!SERVICE_LINK_RE.test(`${url.pathname} ${decodeURIComponent(url.pathname)}`)) continue;
      if (/\.(jpg|jpeg|png|gif|svg|zip|docx?|xlsx?|pptx?)$/iu.test(url.pathname)) continue;
      found.add(url.href);
    } catch {
      // Ignore malformed links.
    }
  }
  return [...found];
}

async function watchSources(db, options) {
  const metrics = { registered: 0, attempted: 0, succeeded: 0, unchanged: 0, changed: 0, new: 0, failed: 0, robotsBlocked: 0, discovered: 0 };
  const errors = [];
  const changed = [];
  const sources = db.prepare('SELECT * FROM sources WHERE active=1 ORDER BY source_id').all();
  metrics.registered = sources.length;
  const robotsCache = new Map();
  const updateSuccess = db.prepare(`UPDATE sources SET last_fetched_at=?, last_changed_at=?, last_hash=?, last_status=?,
                                    content_type=?, fail_count=0, needs_review=0 WHERE source_id=?`);
  const updateFailure = db.prepare(`UPDATE sources SET last_fetched_at=?, last_status=?, fail_count=?, needs_review=? WHERE source_id=?`);
  const insertSource = db.prepare(`INSERT OR IGNORE INTO sources(url, kind, discovered_from, first_seen_at)
                                   VALUES(?, ?, ?, ?)`);

  for (let index = 0; index < sources.length; index++) {
    if (index > 0 && options.delayMs > 0) await sleep(options.delayMs);
    const source = sources[index];
    metrics.attempted++;
    try {
      if (!(await canFetchByRobots(source.url, robotsCache))) {
        metrics.robotsBlocked++;
        updateFailure.run(options.date, 0, source.fail_count, source.needs_review, source.source_id);
        continue;
      }
      const { response, body, finalUrl } = await safeFetch(source.url);
      const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
      let snapshotText = '';
      let snapshotBody = body;
      let extension = '.bin';
      if (contentType.includes('html') || contentType.startsWith('text/')) {
        const html = body.toString('utf8');
        snapshotText = normalizePage(html);
        snapshotBody = Buffer.from(snapshotText, 'utf8');
        extension = '.txt';
        if (options.discoverLinks && contentType.includes('html')) {
          for (const link of discoverServiceLinks(html, finalUrl)) {
            const kind = new URL(link).pathname.toLowerCase().endsWith('.pdf') ? 'pdf' : 'discovered_page';
            const result = insertSource.run(link, kind, source.url, options.date);
            metrics.discovered += Number(result.changes || 0);
          }
        }
      } else if (contentType === 'application/pdf' || source.kind === 'pdf') {
        extension = '.pdf';
      }
      const hash = createHash('sha256').update(snapshotBody).digest('hex');
      const isNew = !source.last_hash;
      const isChanged = Boolean(source.last_hash && source.last_hash !== hash);
      if (isNew || isChanged) {
        const snapshotDir = path.join(options.root, 'snapshots', String(source.source_id));
        mkdirSync(snapshotDir, { recursive: true });
        const snapshotPath = path.join(snapshotDir, `${options.date}${extension}`);
        writeFileSync(snapshotPath, snapshotBody);
        changed.push({
          source_id: source.source_id,
          url: source.url,
          final_url: finalUrl,
          kind: source.kind,
          content_type: contentType,
          first_snapshot: isNew,
          old_hash: source.last_hash || null,
          new_hash: hash,
          snapshot_path: path.relative(REPO, snapshotPath).replaceAll('\\', '/'),
          text_characters: snapshotText.length,
        });
        if (isNew) metrics.new++;
        else metrics.changed++;
      } else {
        metrics.unchanged++;
      }
      metrics.succeeded++;
      updateSuccess.run(options.date, isNew || isChanged ? options.date : source.last_changed_at, hash, response.status, contentType, source.source_id);
    } catch (error) {
      metrics.failed++;
      const failCount = Number(source.fail_count) + 1;
      updateFailure.run(options.date, Number(error.status || 0), failCount, failCount >= 3 ? 1 : 0, source.source_id);
      errors.push({ source_id: source.source_id, url: source.url, error: String(error.message || error) });
    }
    if ((index + 1) % 10 === 0 || index + 1 === sources.length) {
      console.error(`[organisation sources] ${index + 1}/${sources.length}`);
    }
  }
  return { metrics, errors, changed };
}

function serviceRows(db) {
  return db.prepare(`SELECT service_id, carers_unit_id, name, address, district, tel, website, detail_url,
                            categories, subcategories, needs, opening_time, source, status, first_seen_at,
                            last_seen_at, last_verified_at, status_changed_at, deactivated_at, reactivated_at,
                            missing_runs, updated_at
                     FROM services ORDER BY service_id`).all();
}

function writePublished(db, options, runId, sourceMetrics) {
  const rows = serviceRows(db);
  const services = rows.map((row) => ({
    ...row,
    categories: row.categories ? row.categories.split(' | ') : [],
    subcategories: row.subcategories ? row.subcategories.split(' | ') : [],
    needs: row.needs ? row.needs.split(',') : [],
  }));
  const publishDir = path.join(options.root, 'published');
  const exportDir = path.join(options.root, 'exports');
  mkdirSync(publishDir, { recursive: true });
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(path.join(publishDir, 'services.json'), `${JSON.stringify({
    generated_at: new Date().toISOString(),
    run_id: runId,
    source_summary: sourceMetrics,
    services,
  }, null, 2)}\n`, 'utf8');
  const columns = Object.keys(rows[0] ?? { service_id: '' });
  const csv = rowsToCsv(rows, columns);
  writeFileSync(path.join(exportDir, 'services_current.csv'), csv, 'utf8');
  writeFileSync(path.join(publishDir, 'services.csv'), csv, 'utf8');
  return rows;
}

function runCommand(command, args, cwd, options = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: options.capture === false ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    ...options,
  })?.trim();
}

function gitPublish(options, runId, digest) {
  const published = path.join(options.root, 'published', 'services.json');
  const publishedCsv = path.join(options.root, 'published', 'services.csv');
  const remote = runCommand('git', ['remote', 'get-url', 'origin'], REPO);
  const ownerRepo = /github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/iu.exec(remote)?.[1];
  if (!ownerRepo) throw new Error(`Cannot determine GitHub repository from ${remote}`);
  const base = runCommand('gh', ['repo', 'view', ownerRepo, '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'], REPO) || 'main';
  const temp = mkdtempSync(path.join(tmpdir(), 'mindtouch-carers-'));
  const branch = `automation/carers-weekly-${options.date}-${runId}`;
  try {
    runCommand('git', ['clone', '--depth', '1', '--branch', base, remote, temp], REPO);
    const target = path.join(temp, 'data', 'carers', 'published', 'services.json');
    const targetCsv = path.join(temp, 'data', 'carers', 'published', 'services.csv');
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(published, target);
    copyFileSync(publishedCsv, targetCsv);
    runCommand('git', ['checkout', '-b', branch], temp);
    runCommand('git', ['add', '-f', 'data/carers/published/services.json', 'data/carers/published/services.csv'], temp);
    try {
      runCommand('git', ['diff', '--cached', '--quiet'], temp);
      return { status: 'no_changes', base, branch: null, pr_url: null };
    } catch {
      // A non-zero diff --quiet exit means there is a publishable change.
    }
    runCommand('git', ['config', 'user.name', 'OpenClaw Carers Bot'], temp);
    runCommand('git', ['config', 'user.email', 'openclaw-carers@users.noreply.github.com'], temp);
    runCommand('git', ['commit', '-m', `Update carers services ${options.date}`], temp);
    runCommand('git', ['push', '-u', 'origin', branch], temp);
    const prUrl = runCommand('gh', [
      'pr', 'create', '--repo', ownerRepo, '--base', base, '--head', branch,
      '--title', `Update carers services ${options.date}`,
      '--body', `Automated weekly carers-resource update.\n\n${digest}`,
    ], temp);
    let merge = 'requested';
    try {
      runCommand('gh', ['pr', 'merge', prUrl, '--auto', '--squash', '--delete-branch'], temp);
    } catch (error) {
      merge = `pr_open: ${String(error.stderr || error.message || error).slice(0, 300)}`;
    }
    return { status: merge, base, branch, pr_url: prUrl };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function digestText(report) {
  const gitLine = report.git?.pr_url
    ? `GitHub: ${report.git.status} ${report.git.pr_url}`
    : `GitHub: ${report.git?.status ?? 'not requested'}`;
  const lines = [
    `照顧者資源 weekly update — ${report.run_date}`,
    '',
    'Sources',
    `Registered: ${report.sources.registered}`,
    `Attempted: ${report.sources.attempted}`,
    `Successfully read: ${report.sources.succeeded}`,
    `Unchanged: ${report.sources.unchanged}`,
    `Changed: ${report.sources.changed}`,
    `First snapshots: ${report.sources.new}`,
    `Failed: ${report.sources.failed}`,
    `Blocked by robots.txt: ${report.sources.robots_blocked}`,
    `New source pages discovered: ${report.sources.discovered}`,
    '',
    'Services',
    `Directory records processed: ${report.directory.units}`,
    `Added: ${report.services.added}`,
    `Updated: ${report.services.updated}`,
    `Suspected inactive: ${report.services.suspected}`,
    `Deactivated: ${report.services.deactivated}`,
    `Reactivated: ${report.services.reactivated}`,
    `Active total: ${report.services.active_total}`,
    '',
    'Output',
    'services.json: generated',
    'services.csv: generated',
    gitLine,
  ];
  if (report.errors.length) {
    lines.push('', `Failures (${report.errors.length}):`);
    for (const error of report.errors.slice(0, 10)) lines.push(`- ${error.url}: ${error.error}`);
    if (report.errors.length > 10) lines.push(`- plus ${report.errors.length - 10} more; see the run report`);
  }
  return lines.join('\n');
}

function updateRun(db, runId, report, status) {
  db.prepare(`UPDATE runs SET finished_at=?, status=?, directory_units=?, directory_requests=?,
      sources_registered=?, sources_attempted=?, sources_succeeded=?, sources_unchanged=?, sources_changed=?,
      sources_new=?, sources_failed=?, sources_robots_blocked=?, sources_discovered=?, services_added=?,
      services_updated=?, services_suspected=?, services_deactivated=?, services_reactivated=?, active_total=?,
      errors_json=?, git_json=? WHERE run_id=?`).run(
    new Date().toISOString(), status, report.directory.units, report.directory.requests,
    report.sources.registered, report.sources.attempted, report.sources.succeeded, report.sources.unchanged,
    report.sources.changed, report.sources.new, report.sources.failed, report.sources.robots_blocked,
    report.sources.discovered, report.services.added, report.services.updated, report.services.suspected,
    report.services.deactivated, report.services.reactivated, report.services.active_total,
    JSON.stringify(report.errors), JSON.stringify(report.git), runId,
  );
}

async function runPipeline(options) {
  mkdirSync(options.root, { recursive: true });
  const db = new DatabaseSync(path.join(options.root, 'carers.db'));
  ensureSchema(db);
  const runResult = db.prepare(`INSERT INTO runs(started_at, run_date, status, stage) VALUES(?, ?, 'running', ?)`)
    .run(new Date().toISOString(), options.date, options.stage);
  const runId = Number(runResult.lastInsertRowid);
  try {
    if (options.stage === 'extract') {
      const watch = db.prepare("SELECT 1 FROM runs WHERE run_date=? AND stage='watch' AND status='completed' LIMIT 1").get(options.date);
      if (!watch) throw new Error("Refusing extraction: today's website-watch stage is incomplete");
      if (!options.importFile) throw new Error('--extract-only requires --import-file');
    }
    if (options.stage === 'publish') {
      const completedStages = new Set(db.prepare(
        "SELECT stage FROM runs WHERE run_date=? AND run_id<>? AND status='completed'",
      ).all(options.date, runId).map((row) => row.stage));
      const missing = ['directory', 'watch', 'extract'].filter((stage) => !completedStages.has(stage));
      if (missing.length) {
        throw new Error(`Refusing to publish: today's required OpenClaw stages are incomplete: ${missing.join(', ')}`);
      }
    }
    let directory = { rows: [], requests: 0, queries: 0 };
    let serviceCounts = { added: 0, updated: 0, suspected: 0, deactivated: 0, reactivated: 0 };
    if (options.stage === 'all' || options.stage === 'directory') {
      directory = await scrapeDirectory(options);
      const rawColumns = Object.keys(directory.rows[0]);
      const exportDir = path.join(options.root, 'exports');
      mkdirSync(exportDir, { recursive: true });
      const datedExport = path.join(exportDir, `carers_${options.date}.csv`);
      const latestExport = path.join(exportDir, 'latest.csv');
      const rawCsv = rowsToCsv(directory.rows, rawColumns);
      writeFileSync(datedExport, rawCsv, 'utf8');
      writeFileSync(latestExport, rawCsv, 'utf8');
      serviceCounts = applyDirectoryRows(db, directory.rows, {
        runId,
        date: options.date,
        missingThreshold: options.missingThreshold,
        complete: true,
      });
      seedSources(db, directory.rows, options.date);
    }
    if (options.stage === 'extract') {
      const payload = JSON.parse(readFileSync(options.importFile, 'utf8'));
      const queue = JSON.parse(readFileSync(path.join(options.root, 'queues', 'changed_sources.json'), 'utf8'));
      serviceCounts = applyWebExtractions(db, payload, queue, {
        runId,
        date: options.date,
        missingThreshold: options.missingThreshold,
      });
    }
    let sourceResult = {
      metrics: { registered: Number(db.prepare('SELECT COUNT(*) AS n FROM sources WHERE active=1').get().n), attempted: 0, succeeded: 0, unchanged: 0, changed: 0, new: 0, failed: 0, robotsBlocked: 0, discovered: 0 },
      errors: [],
      changed: [],
    };
    if ((options.stage === 'all' || options.stage === 'watch') && options.watchSites) {
      sourceResult = await watchSources(db, options);
    }
    if (options.stage === 'publish') {
      const prior = db.prepare(
        "SELECT * FROM runs WHERE run_date=? AND run_id<>? AND status='completed' ORDER BY run_id",
      ).all(options.date, runId);
      const directoryRun = prior.find((row) => row.stage === 'directory');
      const watchRun = prior.find((row) => row.stage === 'watch');
      directory = {
        rows: [],
        units: Number(directoryRun?.directory_units || 0),
        requests: Number(directoryRun?.directory_requests || 0),
        queries: 0,
      };
      for (const row of prior.filter((item) => ['directory', 'extract'].includes(item.stage))) {
        serviceCounts.added += Number(row.services_added || 0);
        serviceCounts.updated += Number(row.services_updated || 0);
        serviceCounts.suspected += Number(row.services_suspected || 0);
        serviceCounts.deactivated += Number(row.services_deactivated || 0);
        serviceCounts.reactivated += Number(row.services_reactivated || 0);
      }
      if (watchRun) {
        sourceResult.metrics = {
          registered: Number(watchRun.sources_registered || 0),
          attempted: Number(watchRun.sources_attempted || 0),
          succeeded: Number(watchRun.sources_succeeded || 0),
          unchanged: Number(watchRun.sources_unchanged || 0),
          changed: Number(watchRun.sources_changed || 0),
          new: Number(watchRun.sources_new || 0),
          failed: Number(watchRun.sources_failed || 0),
          robotsBlocked: Number(watchRun.sources_robots_blocked || 0),
          discovered: Number(watchRun.sources_discovered || 0),
        };
        sourceResult.errors = JSON.parse(watchRun.errors_json || '[]');
      }
    }

    const queueDir = path.join(options.root, 'queues');
    mkdirSync(queueDir, { recursive: true });
    if (options.stage === 'all' || options.stage === 'watch') {
      writeFileSync(path.join(queueDir, 'changed_sources.json'), `${JSON.stringify({
        generated_at: new Date().toISOString(),
        run_id: runId,
        sources: sourceResult.changed,
      }, null, 2)}\n`, 'utf8');
    }

    const activeTotal = Number(db.prepare("SELECT COUNT(*) AS n FROM services WHERE status='active'").get().n);
    const sources = {
      registered: sourceResult.metrics.registered,
      attempted: sourceResult.metrics.attempted,
      succeeded: sourceResult.metrics.succeeded,
      unchanged: sourceResult.metrics.unchanged,
      changed: sourceResult.metrics.changed,
      new: sourceResult.metrics.new,
      failed: sourceResult.metrics.failed,
      robots_blocked: sourceResult.metrics.robotsBlocked,
      discovered: sourceResult.metrics.discovered,
    };
    const report = {
      run_id: runId,
      run_date: options.date,
      stage: options.stage,
      started_at: db.prepare('SELECT started_at FROM runs WHERE run_id=?').get(runId).started_at,
      finished_at: new Date().toISOString(),
      directory: { units: directory.units ?? directory.rows.length, requests: directory.requests, queries: directory.queries, details_read: options.details },
      sources,
      services: { ...serviceCounts, active_total: activeTotal },
      errors: sourceResult.errors,
      git: { status: options.gitPublish ? 'pending' : 'not requested' },
    };
    writePublished(db, options, runId, sources);
    let digest = digestText(report);
    if (options.gitPublish) {
      try {
        report.git = gitPublish(options, runId, digest);
      } catch (error) {
        report.git = { status: 'failed', error: String(error.stderr || error.message || error).slice(0, 1000) };
        report.errors.push({ url: 'GitHub publication', error: report.git.error });
      }
      digest = digestText(report);
    }
    report.finished_at = new Date().toISOString();
    const reportDir = path.join(options.root, 'reports');
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(path.join(reportDir, `run_${options.date}_${runId}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    writeFileSync(path.join(reportDir, 'latest_digest.txt'), `${digest}\n`, 'utf8');
    updateRun(db, runId, report, report.git.status === 'failed' ? 'completed_with_errors' : 'completed');
    console.log(digest);
    return report.git.status === 'failed' ? 2 : 0;
  } catch (error) {
    const failure = {
      run_id: runId,
      run_date: options.date,
      status: 'failed',
      error: String(error.stack || error),
      finished_at: new Date().toISOString(),
    };
    db.prepare(`UPDATE runs SET finished_at=?, status='failed', errors_json=? WHERE run_id=?`)
      .run(failure.finished_at, JSON.stringify([{ error: failure.error }]), runId);
    const reportDir = path.join(options.root, 'reports');
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(path.join(reportDir, `run_${options.date}_${runId}_failed.json`), `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
    console.log(`照顧者資源 weekly update — ${options.date}\n\nFAILED\n${String(error.message || error)}`);
    console.error(error.stack || error);
    return 1;
  } finally {
    db.close();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
  if (options?.help) printHelp();
  else if (options) process.exitCode = await runPipeline(options);
}

export { applyDirectoryRows, applyWebExtractions, digestText, ensureSchema, inferNeeds, parseArgs, serviceRows };
