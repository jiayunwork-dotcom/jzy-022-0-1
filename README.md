# gold-sequence-service

Gold 码族的生成与周期相关对账服务。给定两条 m 序列的本原多项式（或点名一个已登记的优选对档）与级数 n，服务生成整族 Gold 码，计算周期自相关与族内互相关，并核对旁瓣是否落在由 n 决定的三值集合内。仅经 HTTP 对外提供，无请求间状态、不落库。

## 运行

```bash
npm ci
npm start          # 监听 PORT（默认 3000）
npm test           # node:test 全量用例
```

Docker（单容器）：

```bash
docker build -t gold-sequence-service .
docker run -p 3000:3000 gold-sequence-service
```

## API

### `GET /api/gold/profiles`
列出已登记的优选对档（启动时从 `config/profiles.json` 载入并逐一实证校验，运行期只读）。内置示范档 `gold-n7-demo`（n=7，N=127，八进制 211/217）。

### `GET /api/gold/profiles/:name`
返回单个档的详情；未知档名 → `404 UNKNOWN_PROFILE`。

### `POST /api/gold/reconcile`
按档名：

```json
{ "profile": "gold-n7-demo" }
```

或当次请求显式给出多项式（`octal` / `binary` / `hex` / `decimal` / `exponents` 五选一）：

```json
{
  "n": 7,
  "polynomials": {
    "first":  { "octal": "211" },
    "second": { "exponents": [7, 3, 2, 1, 0] }
  }
}
```

成功响应（节选）：

```json
{
  "n": 7, "N": 127, "familySize": 129,
  "threeValueSet": [-17, -1, 15],
  "threeValueFormula": "{-1, -1 + 2^((n+1)/2), -1 - 2^((n+1)/2)} with n=7",
  "zeroShift": 127, "qualified": true,
  "violations": [], "totalViolations": 0,
  "audit": { "mode": "exhaustive", "pairsChecked": 8385, "valuesObserved": [-17, -1, 15] }
}
```

`violations` 列出旁瓣超界的位移（若有），形如 `{type, memberA, memberB, shift, value}`，最多保留前 50 条并置 `violationsTruncated`。

### 错误（均带 `error.type`）

| type | HTTP | 含义 |
|---|---|---|
| `INVALID_REQUEST` | 400 | 请求体形错误（profile 与 polynomials 二选一） |
| `EMPTY_POLYNOMIAL` | 400 | 空多项式 |
| `DEGREE_MISMATCH` | 400 | 多项式次数与 n 不符 |
| `N_OUT_OF_RANGE` | 400 | 级数越界（服务钉死 5 ≤ n ≤ 13） |
| `EVEN_DEGREE` | 400 | n 为偶数，直接拒绝 |
| `UNKNOWN_PROFILE` | 404 | 未知档名 |
| `NOT_PRIMITIVE` | 422 | 多项式非本原，生成前拒绝 |
| `NOT_PREFERRED_PAIR` | 422 | 两条 m 序列构不成优选对，生成前拒绝 |

## 判定规则

- 码长 N = 2^n − 1，码片 ±1；族成员 = 两条 m 序列 + 一条与另一条各循环移位按位相乘，共 N + 2 条。
- 周期相关：位移 k 处整周期对应码片相乘求和（带环绕），不使用截断的线性相关。
- 三值集合（n 为奇数）：t = 2^((n+1)/2)，集合 {−1, −1+t, −1−t}；公式随结果返回。
- 零位移自相关必须等于 N；非零位移自相关与族内互相关只能取三值。平衡性（汉明重量/直流）不是判定尺子。
- 本原性：x 模 p 的阶恰为 2^n − 1（含 N 的素因子逐一排除）。
- 优选对：两条 m 序列的周期互相关全表落在三值集合内（实证、精确）；由移位相加性，整族相关值都归约到这张基表。
- 对账模式：族对数 × N² 不超限（n ≤ 7）时逐对逐位移穷举（`exhaustive`）；更大级数用基表归约给出整族结论并逐成员核对零位移（`base-table`），响应中注明覆盖方式。

## 模块划分

| 文件 | 职责 |
|---|---|
| `src/gf2.js` | GF(2) 多项式运算与本原性判定 |
| `src/polynomialParser.js` | 多项式表示解析（octal/binary/hex/decimal/exponents） |
| `src/msequence.js` | LFSR 生成 m 序列 |
| `src/preferredPair.js` | 优选对判定 |
| `src/family.js` | Gold 族生成 |
| `src/correlation.js` | 周期自/互相关 |
| `src/threeValue.js` | 三值集合 |
| `src/audit.js` | 三值核对（对账） |
| `src/reconcile.js` | 单笔对账编排（无状态，并发隔离） |
| `src/profiles.js` | 优选对档登记（启动载入、运行期只读） |
| `src/routes.js` / `src/app.js` / `src/server.js` | HTTP 层 |

`scripts/find-preferred-pairs.js` 为开发工具：用 Gold 抽取（d = 2^k+1）+ Berlekamp-Massey 为各级数求优选对并实证校验（登记档即由此产生）。
