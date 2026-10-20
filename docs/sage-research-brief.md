# 古人開解 — Research Brief for the Sage Database

> **For the AI researcher reading this:** you are helping build a database of **1,000 historical figures from all over the world (3000 BC – today)**. Each figure faced real hardships. Follow this brief exactly. Output **CSV only**, in the formats below.

---

## 1. What the database is for

MindTouch is a Hong Kong mental-wellbeing app. A user types a life problem (人生難題), e.g. "I failed my exam and my parents are disappointed".

The app then:
1. Matches the problem to **one** historical figure (古人) who faced something similar.
2. An AI role-plays that figure, **speaking in Cantonese in that figure's own style**. The figure shares what happened to them, how they felt, how they got through it, and gives gentle, positive suggestions.

The role-play AI may only use facts stored in this database. **Your accuracy matters.** If a fact is not in the record, it must not be in the database.

---

## 2. Output files

Produce two CSV files:

| File | One row per | Target size |
|---|---|---|
| `sages.csv` | historical figure | 1,000 rows |
| `sage_trials.csv` | one hardship faced by a figure | 1–3 per figure (~1,800 rows) |

### CSV rules

- UTF-8, header row, **every field wrapped in double quotes**.
- A `"` inside a field is written as `""`.
- **No line breaks inside fields.** Write paragraphs as one line.
- Multi-value fields use `;` as the separator, with no spaces, e.g. `失業;被冤枉;孤獨`.
- Years are integers. **BC years are negative**: 551 BC → `-551`. If the year is uncertain, give your best estimate and add `c.` to `era_label_zh`.
- Chinese text is in **Traditional Chinese (繁體)**.
- Empty field = `""`. Never write `N/A`, `unknown`, or `-`.

---

## 3. `sages.csv` — columns

| # | Column | Required | Description | Example |
|---|---|---|---|---|
| 1 | `sage_id` | ✅ | `SG` + 4 digits, assigned from the master list (§6) | `SG0042` |
| 2 | `name_zh_hant` | ✅ | Common Hong Kong Chinese name | `蘇軾` |
| 3 | `name_en` | ✅ | Common English name | `Su Shi` |
| 4 | `name_original` | | Name in the original script/language, if not Chinese/English | `Ludwig van Beethoven` / `ガンジー` → use original |
| 5 | `alt_names_zh` | | Other names, separated by `;` | `蘇東坡;東坡居士` |
| 6 | `gender` | ✅ | `M` / `F` / `X` | `M` |
| 7 | `region` | ✅ | One code from §5.1 | `EA-CN` |
| 8 | `country_modern` | ✅ | Present-day country (Traditional Chinese) | `中國` |
| 9 | `era_label_zh` | ✅ | Human-readable era | `北宋` / `古羅馬帝國` / `c. 公元前1200年` |
| 10 | `born_year` | ✅ | Integer, negative for BC | `1037` |
| 11 | `died_year` | ✅ | Integer, negative for BC. **Must be deceased** (§7) | `1101` |
| 12 | `historicity` | ✅ | `historical` / `semi_legendary` / `legendary` | `historical` |
| 13 | `identity_zh` | ✅ | Roles, 2–5 words, separated by `;` | `文學家;書法家;官員` |
| 14 | `life_summary_zh` | ✅ | Life story, **150–300 字**, neutral and factual. Include the main events, ups and downs, and what they are remembered for | `蘇軾，北宋眉州人……` |
| 15 | `personality_zh` | ✅ | Character traits, 3–6, separated by `;` | `豁達;幽默;愛美食;重情義` |
| 16 | `voice_style_zh` | ✅ | **How they talk**: tone, pace, typical imagery, how they address others. 40–100 字 | `語氣輕鬆豁達，愛自嘲，喜歡用食物、月亮、江水作比喻，稱對方做「朋友」` |
| 17 | `speech_traits_zh` | | Recurring phrases, metaphors, rhetorical habits, separated by `;` | `用反問;引自己詩句;講完道理加句笑話` |
| 18 | `address_user_as_zh` | ✅ | How this figure would address the user, in Cantonese | `後生仔` / `朋友` / `孩子` / `同學` |
| 19 | `cantonese_sample` | ✅ | **2–4 sentences in Hong Kong Cantonese, first person, in their voice** (§8) | `我當年俾人捉咗去坐監，出返嚟又俾人踢去黃州，真係乜都冇晒。不過你估點？我喺東坡嗰度種田，自己炆豬肉，仲食得好開心添。` |
| 20 | `signature_quote_original` | | A **verified** famous quote in the original language | `竹杖芒鞋輕勝馬，誰怕？一蓑煙雨任平生。` |
| 21 | `signature_quote_zh_hant` | | Traditional Chinese version (same as above if already Chinese) | `竹杖芒鞋輕勝馬，誰怕？一蓑煙雨任平生。` |
| 22 | `signature_quote_source` | | Exact work/speech/letter it comes from | `《定風波·莫聽穿林打葉聲》` |
| 23 | `avoid_zh` | ✅ | What the role-play must **not** do for this figure, separated by `;` | `唔好扮佢識現代科技;唔好講佢支持新黨` |
| 24 | `sensitivity_notes_zh` | | Controversies or sensitive facts the AI should handle carefully (§7.3) | `晚年與政敵和解，唔好簡化為好人壞人` |
| 25 | `source_urls` | ✅ | 1–3 reliable sources, separated by `;` (§9) | `https://zh.wikipedia.org/wiki/蘇軾;https://www.britannica.com/biography/Su-Shi` |
| 26 | `confidence` | ✅ | `high` / `medium` / `low`: how well documented this figure is | `high` |
| 27 | `checked_date` | ✅ | `YYYY-MM-DD` | `2026-10-20` |

---

## 4. `sage_trials.csv` — columns

Each row is **one specific hardship** that a matching user could relate to. This is the table the app searches when it matches a problem.

| # | Column | Required | Description | Example |
|---|---|---|---|---|
| 1 | `trial_id` | ✅ | `{sage_id}-{n}`, n = 1, 2, 3 | `SG0042-1` |
| 2 | `sage_id` | ✅ | Must exist in `sages.csv` | `SG0042` |
| 3 | `problem_category` | ✅ | **One** code from §5.2: the main category | `P02` |
| 4 | `secondary_categories` | | Up to 2 more codes, separated by `;` | `P10;P18` |
| 5 | `problem_tags_zh` | ✅ | 3–8 short keywords a user might type, separated by `;` | `被冤枉;坐監;被誣告;前途盡毀;被貶` |
| 6 | `year_approx` | ✅ | Year it happened | `1079` |
| 7 | `age_at_time` | | Their approximate age then | `42` |
| 8 | `title_zh` | ✅ | Short title, ≤ 12 字 | `烏台詩案，貶謫黃州` |
| 9 | `situation_zh` | ✅ | **What happened**, factual, 80–200 字 | `因詩文被政敵指為諷刺朝政，被捕入御史台獄一百三十日，險被處死。出獄後貶為黃州團練副使，不得簽書公事，收入微薄。` |
| 10 | `feelings_zh` | ✅ | How they felt, **based on their own writings or reliable accounts**, 30–100 字 | `獄中以為必死，寫詩訣別弟弟蘇轍；初到黃州深感孤獨，自言「寂寞沙洲冷」。` |
| 11 | `feelings_evidence` | | The letter, poem or account showing those feelings | `《獄中寄子由》;《卜算子·黃州定慧院寓居作》` |
| 12 | `how_coped_zh` | ✅ | **Concrete actions** they took to get through it, 50–150 字 | `向官府討得一塊荒地親自耕種，自號東坡居士；研究烹飪；與漁夫農民交朋友；大量寫作。` |
| 13 | `turning_point_zh` | | The moment things began to change | `一次途中遇雨，同行皆狼狽，他卻吟出《定風波》。` |
| 14 | `outcome_zh` | ✅ | What happened afterwards, 30–120 字 | `黃州四年寫出《赤壁賦》《念奴嬌·赤壁懷古》等傳世之作，後被召回朝廷。` |
| 15 | `lesson_zh` | ✅ | **One sentence**: the core insight, in plain language | `環境改變唔到，但點樣睇同點樣過每一日，係自己揀。` |
| 16 | `suggestions_zh` | ✅ | **2–4 practical, modern, safe** suggestions that follow from their experience, separated by `;` | `先照顧好食同瞓;搵一樣細小但做得到嘅事每日做;同身邊普通人傾吓偈;將感受寫低` |
| 17 | `relevant_quote` | | A **verified** quote from this period | `回首向來蕭瑟處，歸去，也無風雨也無晴。` |
| 18 | `relevant_quote_source` | | Source of that quote | `《定風波》` |
| 19 | `story_cantonese` | ✅ | **First-person Cantonese telling of this trial, 150–300 字, in their voice** (§8). Must contain only facts from columns 9–14 | `朋友，我同你講吓我四十幾歲嗰陣嘅事……` |
| 20 | `suitable_for` | | Who this story suits best, separated by `;` | `中年;打工仔;被冤枉者` |
| 21 | `not_suitable_for` | | Situations where this story could hurt, separated by `;` | `剛失去子女嘅人` |
| 22 | `evidence_url` | ✅ | Source for this specific hardship | `https://zh.wikipedia.org/wiki/烏臺詩案` |
| 23 | `confidence` | ✅ | `high` / `medium` / `low` | `high` |
| 24 | `checked_date` | ✅ | `YYYY-MM-DD` | `2026-10-20` |

---

## 5. Controlled vocabularies

### 5.1 Region codes (`region`)

| Code | Region | Target count |
|---|---|---|
| `EA-CN` | 中國（含港澳台） | 280 |
| `EA-JP` | 日本 | 35 |
| `EA-KR` | 朝鮮半島 | 25 |
| `SEA` | 東南亞 | 35 |
| `SA` | 南亞（印度、巴基斯坦、斯里蘭卡等） | 55 |
| `CA` | 中亞、蒙古、西藏 | 20 |
| `ME` | 中東、伊朗、土耳其 | 60 |
| `AF-N` | 北非、古埃及 | 35 |
| `AF-SS` | 撒哈拉以南非洲 | 45 |
| `EU-S` | 南歐（希臘、意大利、西班牙、葡萄牙） | 90 |
| `EU-W` | 西歐（英、法、德、荷、比、瑞士等） | 130 |
| `EU-N` | 北歐 | 20 |
| `EU-E` | 東歐、俄羅斯 | 50 |
| `AM-N` | 北美 | 70 |
| `AM-LA` | 拉丁美洲、加勒比 | 40 |
| `OC` | 大洋洲 | 10 |
| | **Total** | **1,000** |

### 5.2 Problem categories (`problem_category`)

| Code | Category | Min. trials |
|---|---|---|
| `P01` | 事業挫敗／失業／被炒 | 100 |
| `P02` | 被冤枉／被出賣／被陷害 | 100 |
| `P03` | 喪親／失去摯愛 | 120 |
| `P04` | 失戀／婚姻破裂／感情受挫 | 100 |
| `P05` | 疾病／殘疾／身體限制 | 120 |
| `P06` | 貧窮／財困／欠債 | 100 |
| `P07` | 懷才不遇／不被認同 | 120 |
| `P08` | 孤獨／被排擠／無朋友 | 100 |
| `P09` | 屢戰屢敗／失敗後重來 | 120 |
| `P10` | 流亡／離鄉／移民適應 | 80 |
| `P11` | 抉擇兩難／良心掙扎 | 80 |
| `P12` | 迷失方向／中年危機／年老 | 80 |
| `P13` | 家庭衝突／父母子女關係 | 100 |
| `P14` | 壓力／焦慮／抑鬱 | 100 |
| `P15` | 歧視／欺凌／不公平對待 | 100 |
| `P16` | 照顧者重擔（照顧病人、老人、家人） | 60 |
| `P17` | 考試／學業失敗 | 60 |
| `P18` | 坐牢／失去自由 | 60 |

The minimums add up to about 1,800. Check coverage after every batch.

### 5.3 Era distribution (by `born_year`)

| Era | Target |
|---|---|
| before -500 (incl. legendary) | 60 |
| -500 to 0 | 120 |
| 1 to 1000 | 150 |
| 1001 to 1500 | 140 |
| 1501 to 1800 | 170 |
| 1801 to 1900 | 160 |
| 1901 to today | 200 |

### 5.4 Other balance targets

- **At least 30% women.**
- No more than **10%** emperors, kings or generals. Include poets, scientists, artists, monks, merchants, doctors, mothers, slaves who became free, carers, athletes, ordinary people with documented lives, and so on.
- Prefer figures whose **hardship and coping are well documented**, ideally in their own words (letters, diaries, poems, memoirs).

---

## 6. Workflow

### Step 1: Master list (do this first)

Produce `master_list.csv` with 1,000 rows and these columns:

`sage_id,name_zh_hant,name_en,gender,region,born_year,died_year,main_categories`

- Assign IDs `SG0001`–`SG1000`, sorted by `born_year`.
- `main_categories` = the 1–3 `P` codes you expect to cover.
- Check the balance targets in §5 **before** moving on, and print a coverage table.
- **No duplicates.** Check alternate names and spellings (e.g. 釋迦牟尼 = Siddhartha Gautama = Buddha).

### Step 2: Fill in batches

- Work in batches of **25 figures** (by `sage_id` range, e.g. `SG0001`–`SG0025`).
- For each batch, output `sages.csv` rows and then `sage_trials.csv` rows, both with header rows.
- If several AIs work in parallel, give each one **a different ID range** from the master list.

### Step 3: Self-check each batch

Before returning a batch, confirm:

- [ ] Every required field is filled.
- [ ] Every `trial_id` matches its `sage_id`; every `sage_id` exists.
- [ ] Every quote is verified, with an exact source; otherwise it is left empty.
- [ ] Every `story_cantonese` uses only facts from that row.
- [ ] Every Cantonese field passes the §8 check.
- [ ] No living person; no person excluded by §7.
- [ ] The CSV parses: all fields quoted, no line breaks inside fields.

---

## 7. Inclusion and exclusion rules

### 7.1 Include

- People who are **deceased**.
- Legendary or semi-legendary figures (e.g. 大禹、吉爾伽美什) **only** for the era before -500, and they must be marked `semi_legendary` / `legendary`.

### 7.2 Exclude

- Anyone still living.
- People mainly known for genocide, mass killing, terrorism or abuse, even if they also "overcame hardship".
- Figures whose life is too poorly documented to fill the `situation / how_coped / outcome` fields truthfully.

### 7.3 Sensitive cases (include, but handle carefully)

- **Figures who died by suicide** (e.g. 屈原、梵高、Virginia Woolf): you may use a trial from a time **when they were still coping**. Never frame their death as a solution or as noble. Set `not_suitable_for` to `有自殺念頭嘅人`, and describe it in `sensitivity_notes_zh`.
- Figures who held views now seen as harmful (e.g. on slavery or women): note it in `sensitivity_notes_zh`, and add `avoid_zh` items so the role-play doesn't repeat those views.
- Religious founders: keep it biographical and respectful. No preaching, and no claims about miracles as fact.

---

## 8. Cantonese writing rules

Fields: `cantonese_sample`, `story_cantonese`, `lesson_zh`, `suggestions_zh`, `address_user_as_zh`.

**Use natural Hong Kong spoken Cantonese written in Traditional Chinese.**

| ✅ Use | ❌ Not Mandarin |
|---|---|
| 係 | 是 |
| 嘅 | 的 |
| 咗 | 了 |
| 唔 | 不 |
| 喺 | 在 |
| 佢 | 他／她 |
| 啲 | 些 |
| 冇 | 沒有 |
| 點樣 | 怎樣 |
| 依家 | 現在 |
| 好似 | 好像 |

**Style:**
- First person ("我"), speaking directly to the user. Warm and unhurried, like a wise elder chatting over tea.
- **Keep the figure's character**: 孔子 is patient and teacherly; 李白 is free-spirited and bold; 蘇軾 jokes about himself; Lincoln is plain-spoken with stories; Marie Curie is calm and precise.
- Classical or foreign quotes: give the original first, then explain it in Cantonese. E.g. `「一蓑煙雨任平生」，即係話落雨都唔緊要，披住件蓑衣照行。`
- No modern slang or internet language, and no anachronisms (a Tang poet doesn't know about phones).
- Never lecture, blame or diagnose. Share, don't preach.
- `suggestions_zh` must be **safe and practical today**, e.g. sleep, talk to someone, write it down, small steps, seek a professional. Never "quit your job" or "leave your family", and never anything medical.

**Example `story_cantonese` (蘇軾, SG0042-1):**

> 朋友，我四十二歲嗰年，因為寫咗幾首詩，俾人話我諷刺朝廷，成個人俾人捉咗入御史台坐監，一坐就成百幾日。嗰陣我真係以為自己死梗，仲寫咗首詩同我細佬告別。後來雖然留返條命，但俾人貶咗去黃州，名義上係官，其實乜權都冇，人工又少。我初初好失落，覺得成世人完咗。不過你估點？我同官府攞咗幅荒地，自己落田耕種，改咗個號叫「東坡居士」。我仲研究點樣炆豬肉，同啲漁夫農夫飲酒傾偈。就係喺嗰幾年，我寫出咗《赤壁賦》。所以呢，有時跌到最低，反而會見到之前睇唔到嘅風景。

---

## 9. Accuracy and sources

- **Never invent** facts, dates, feelings, dialogue or quotes. If unsure, leave the optional field empty and lower `confidence`.
- `feelings_zh` must be based on the person's own writing or reliable accounts. Do not imagine emotions.
- Quotes: only well-attested ones with an exact source. **Many popular "quotes" are misattributed** (e.g. many lines credited to Einstein, Buddha, Confucius or Lincoln). Check them on Wikiquote or a primary source; if in doubt, leave the quote empty.
- Preferred sources, in order:
  1. Primary texts (正史、文集、letters, diaries, speeches), e.g. ctext.org, Project Gutenberg
  2. Encyclopaedias: Britannica, Stanford Encyclopedia of Philosophy, 中文維基百科, English Wikipedia
  3. University or museum pages
- Avoid content farms, motivational-quote sites, 百度百科 as the only source, and AI-generated pages.
- Where historians disagree, follow the mainstream view and mention the dispute in `sensitivity_notes_zh`.

---

## 10. Complete example rows

**`sages.csv`**

```csv
"sage_id","name_zh_hant","name_en","name_original","alt_names_zh","gender","region","country_modern","era_label_zh","born_year","died_year","historicity","identity_zh","life_summary_zh","personality_zh","voice_style_zh","speech_traits_zh","address_user_as_zh","cantonese_sample","signature_quote_original","signature_quote_zh_hant","signature_quote_source","avoid_zh","sensitivity_notes_zh","source_urls","confidence","checked_date"
"SG0042","蘇軾","Su Shi","","蘇東坡;東坡居士","M","EA-CN","中國","北宋","1037","1101","historical","文學家;書法家;畫家;官員","蘇軾，字子瞻，北宋眉州眉山人，二十一歲與弟蘇轍同科進士，深得歐陽脩賞識。因反對王安石部分新法，自請外放，歷任杭州、密州、徐州、湖州等地方官，興修水利，關心民生。1079年烏台詩案下獄，險死，後貶黃州，開墾東坡，寫成《赤壁賦》等名篇。舊黨執政後回朝任翰林學士，又因直言得罪同黨，再次外放。晚年接連貶至惠州及海南儋州，在當地辦學教化。1101年遇赦北歸，途中病逝常州。詩、詞、文、書、畫皆為一代大家，以豁達樂觀聞名後世。","豁達;幽默;愛美食;重情義;直言","語氣輕鬆豁達，好似老朋友傾偈；愛自嘲，喜歡用食物、月亮、江水、風雨作比喻；講到苦處會一笑帶過，再帶出道理","引自己詩詞;自嘲;以食物作比喻;講完道理加句笑話","朋友","我呢世人俾人貶咗三次，一次比一次遠，最後去到海南島。不過去到邊我都搵到好嘢食、搵到朋友傾偈。人生呢，好似食飯咁，有鹹有淡先至有味。","竹杖芒鞋輕勝馬，誰怕？一蓑煙雨任平生。","竹杖芒鞋輕勝馬，誰怕？一蓑煙雨任平生。","《定風波·莫聽穿林打葉聲》","唔好扮佢識現代科技;唔好講佢冇講過嘅政治立場;唔好將新舊黨簡化為好人壞人","烏台詩案涉及新舊黨爭，宜只講個人遭遇","https://zh.wikipedia.org/wiki/蘇軾;https://www.britannica.com/biography/Su-Shi","high","2026-10-20"
```

**`sage_trials.csv`**

```csv
"trial_id","sage_id","problem_category","secondary_categories","problem_tags_zh","year_approx","age_at_time","title_zh","situation_zh","feelings_zh","feelings_evidence","how_coped_zh","turning_point_zh","outcome_zh","lesson_zh","suggestions_zh","relevant_quote","relevant_quote_source","story_cantonese","suitable_for","not_suitable_for","evidence_url","confidence","checked_date"
"SG0042-1","SG0042","P02","P01;P18","被冤枉;坐監;被誣告;前途盡毀;被貶;降職","1079","42","烏台詩案，貶謫黃州","因詩文被政敵指為諷刺朝政，被捕入御史台獄約一百三十日，險被處死。出獄後貶為黃州團練副使，不得簽書公事，俸祿微薄，生活困頓。","獄中以為必死，寫詩向弟弟蘇轍訣別；初到黃州深感孤獨失意，自比孤鴻。","《獄中寄子由》;《卜算子·黃州定慧院寓居作》","向官府申請城東一塊荒廢營地親自耕種，自號東坡居士；研究烹飪；與漁夫、農夫及僧人交朋友；大量讀書寫作。","一次出遊遇雨，同行者皆狼狽，他卻從容吟出《定風波》，心境由此開闊。","黃州四年寫出前後《赤壁賦》、《念奴嬌·赤壁懷古》等傳世之作，書法《寒食帖》亦成於此時。1084年離開黃州，其後被召回朝廷。","環境改變唔到，但點樣睇同點樣過每一日，係自己揀。","先照顧好食同瞓;每日搵一件細小但做得到嘅事;同身邊嘅人傾吓偈，唔好收埋自己;將心入面嘅嘢寫低","回首向來蕭瑟處，歸去，也無風雨也無晴。","《定風波·莫聽穿林打葉聲》","朋友，我四十二歲嗰年，因為寫咗幾首詩，俾人話我諷刺朝廷，成個人俾人捉咗入御史台坐監，一坐就成百幾日。嗰陣我真係以為自己死梗，仲寫咗首詩同我細佬告別。後來雖然留返條命，但俾人貶咗去黃州，名義上係官，其實乜權都冇，人工又少。我初初好失落，覺得成世人完咗。不過你估點？我同官府攞咗幅荒地，自己落田耕種，改咗個號叫「東坡居士」。我仲研究點樣煮餸，同啲漁夫農夫飲酒傾偈。就係喺嗰幾年，我寫出咗《赤壁賦》。所以呢，有時跌到最低，反而會見到之前睇唔到嘅風景。","中年;打工仔;被冤枉者;被降職者","","https://zh.wikipedia.org/wiki/烏臺詩案","high","2026-10-20"
```

---

## 11. Prompt to start the researcher AI

Copy this into the other AI, together with this whole file:

> Read the attached research brief carefully. First complete **Step 1**: produce `master_list.csv` with 1,000 figures that meet every balance target in §5, followed by a coverage table (region, era, gender, problem category). Wait for my approval. After that, I will ask you for batches of 25 (Step 2). Follow the CSV rules in §2 and the accuracy rules in §9 strictly. If you are unsure of a fact, leave the optional field empty and lower `confidence`. Never invent anything.

For later batches:

> Continue with Step 2 for `SG0026`–`SG0050` from the approved master list. Output `sages.csv` rows, then `sage_trials.csv` rows, then the Step 3 checklist results.
