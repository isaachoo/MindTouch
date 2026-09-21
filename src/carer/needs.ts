// Part 2: what the carer wants to sort out, mapped to carers.hk directory filters.
// audience 30 = 長者服務, 31 = 照顧者服務. type = main category, subtype = type5.
export interface Query {
  audience: 30 | 31;
  type: number;
  subtype?: number;
}

export interface Need {
  id: string;
  label: string;
  hint: string;
  caveat: string;
  queries: Query[];
}

export const needs: Need[] = [
  {
    id: 'H01',
    label: '了解長者需要',
    hint: '醫療資訊、社區支援、認知障礙症',
    caveat: '以下係可能幫到手嘅專業服務；長者嘅照顧需要仍然要由專業人士評估。',
    queries: [
      { audience: 30, type: 856 },
      { audience: 30, type: 984 },
      { audience: 30, type: 86 },
    ],
  },
  {
    id: 'H02',
    label: '學習照顧方法',
    hint: '照顧者課程、學習資源',
    caveat: '以下係提供照顧者課程同學習資源嘅機構；個別照顧步驟，記得向專業人士查詢。',
    queries: [{ audience: 31, type: 91 }],
  },
  {
    id: 'H03',
    label: '搵人幫手照顧',
    hint: '上門照顧、日間中心、陪診、離院支援',
    caveat: '包括上門照顧、日間中心、陪診同離院支援。',
    queries: [{ audience: 30, type: 83 }],
  },
  {
    id: 'H04',
    label: '安排休息或者替手',
    hint: '日間暫託、住宿暫託',
    caveat: '暫託服務未必即時有位，夜間照顧同具體日期要直接向機構查詢。',
    queries: [{ audience: 30, type: 84 }],
  },
  {
    id: 'H05',
    label: '處理照顧開支',
    hint: '經濟援助、照顧者基金',
    caveat: '申請資格要另外向機構或社署查清楚。',
    queries: [
      { audience: 30, type: 1262 },
      { audience: 31, type: 95 },
    ],
  },
  {
    id: 'H06',
    label: '照顧自己身心',
    hint: '照顧者互助、支援服務、熱線',
    caveat: '以下係較廣泛嘅照顧者支援同熱線；未必逐項對應輔導、失眠或身體痛症。',
    queries: [
      { audience: 31, type: 92 },
      { audience: 31, type: 94 },
      { audience: 31, type: 93 },
    ],
  },
  {
    id: 'H07',
    label: '處理家庭同生活安排',
    hint: '綜合家庭服務中心、護老者支援',
    caveat: '以下係合適嘅求助途徑；家庭矛盾或工作安排等具體問題，可以直接同社工傾。',
    queries: [
      { audience: 31, type: 94, subtype: 914 },
      { audience: 31, type: 94, subtype: 96 },
    ],
  },
  {
    id: 'H08',
    label: '了解同申請服務',
    hint: '社區支援單位、支援照顧者服務',
    caveat: '以下機構可以幫你了解服務；資格計算同申請手續要向機構查詢。',
    queries: [
      { audience: 31, type: 981 },
      { audience: 31, type: 94 },
    ],
  },
  {
    id: 'H09',
    label: '改善家居同外出安排',
    hint: '復康器具、平安鐘、護送陪診',
    caveat: '家居改裝同無障礙要求，要同機構逐項確認。',
    queries: [
      { audience: 30, type: 87 },
      { audience: 30, type: 88 },
      { audience: 30, type: 83, subtype: 111 },
    ],
  },
  {
    id: 'H10',
    label: '為將來做準備',
    hint: '院舍服務、遺囑、預設醫療指示',
    caveat: '以下係有用嘅起點；具體規劃同決定，建議同家人及專業人士一齊傾。',
    queries: [
      { audience: 30, type: 85 },
      { audience: 31, type: 94, subtype: 96 },
      { audience: 30, type: 89, subtype: 1426 },
    ],
  },
  {
    id: 'H11',
    label: '應付突然轉變',
    hint: '離院支援、暫託、緊急支援',
    caveat: '以下服務未確認即時有位；緊急情況請先打 182 183。',
    queries: [
      { audience: 30, type: 83, subtype: 112 },
      { audience: 30, type: 84 },
      { audience: 31, type: 94 },
    ],
  },
  {
    id: 'H12',
    label: '面對晚期照顧同離別',
    hint: '晚期照顧、善終、殯葬資訊',
    caveat: '包括晚期照顧、哀傷支援同殯葬相關服務。',
    queries: [
      { audience: 30, type: 89 },
      { audience: 31, type: 1004 },
    ],
  },
];

export function findNeed(id: string): Need | undefined {
  return needs.find((n) => n.id === id);
}

export const districts: { id: number; name: string }[] = [
  { id: 474, name: '中西區' },
  { id: 473, name: '灣仔區' },
  { id: 527, name: '東區' },
  { id: 476, name: '南區' },
  { id: 479, name: '油尖旺區' },
  { id: 477, name: '深水埗區' },
  { id: 478, name: '九龍城區' },
  { id: 480, name: '黃大仙區' },
  { id: 482, name: '觀塘區' },
  { id: 528, name: '葵青區' },
  { id: 529, name: '荃灣區' },
  { id: 530, name: '屯門區' },
  { id: 531, name: '元朗區' },
  { id: 532, name: '北區' },
  { id: 533, name: '大埔區' },
  { id: 534, name: '沙田區' },
  { id: 481, name: '西貢區' },
  { id: 475, name: '離島區' },
];

/** Public, pre-filtered carers.hk page for a query. Always works, even if our API does not. */
export function carersLink(q: Query, area?: number): string {
  const u = new URL('https://www.carers.hk/articles/service-and-resource');
  u.searchParams.set('action', 'search');
  u.searchParams.set('aduience', String(q.audience));
  u.searchParams.set('type', String(q.type));
  if (q.subtype) u.searchParams.set('type5', String(q.subtype));
  if (area) u.searchParams.set('area', String(area));
  return u.toString();
}
