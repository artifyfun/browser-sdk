# 合并总结：上游 v5.33.0 → v5.35.1

- **合并分支**：`merge-upstream-v5.35.1`（基于 `v5.32.5_请求已修改版本`）
- **上游仓库**：https://github.com/DataDog/browser-sdk
- **合并版本**：v5.35.1
- **规模**：143 个文件变更，合并了 40 个上游 commit，3 个版本跨度（v5.33.0 / v5.34.0-v5.34.1 / v5.35.0-v5.35.1）

---

## 一、上游新功能

| 功能 | 版本 | 说明 |
|------|------|------|
| **Trace 概率采样** | v5.33.0 | 重构 trace ID 生成（新增 `identifier.ts`、`sampler.ts`），支持 BigInt，采样逻辑从 SDK 侧移到 ID 侧 |
| **`window.open` 监听** | v5.34.0 | 新增 `windowOpenObservable.ts`，用于捕获 `window.open` 调用 |
| **`sessionPersistence` 配置** | v5.35.0 | 新增 `sessionPersistence` 选项，可强制使用 localStorage 存储 session |
| **Electron 自定义 schema** | v5.34.1 | 支持 Electron 环境自定义 schema |
| **Recorder API 重构** | v5.33.0 | 将录制逻辑拆分为 `preStartStrategy` + `postStartStrategy`，支持手动/自动启动分离 |

## 二、上游 Bug 修复

| 修复 | 版本 |
|------|------|
| `unobserve` 对非 Element 参数报错 | v5.34.0 |
| `addError` 支持所有 Error 子类（TypeError、RangeError 等） | v5.34.1 |
| 视口尺寸收集延迟优化（避免布局抖动） | v5.34.1 |
| `traceSampleRate` 默认值移到 config 验证层，新增 `rulePsr` 字段 | v5.34.1 |
| `setViewContext` 的 view update 节流 | v5.35.1 |
| sessionReplay 采样率为 0 时不自动开始录制 | v5.33.0 |

## 三、自定义功能保留情况

| 自定义功能 | 合并处理 |
|-----------|---------|
| **`x-shsnc-*` 请求头前缀** | 保留。`makeTracingHeaders` 中继续使用 `x-shsnc-origin/trace-id/parent-id` |
| **`shsnc` propagator 类型** | 保留。与 `datadog` 并列在 case 分支中 |
| **`sw8` propagator** | 保留。适配新签名，`toDecimalString()` 改为 `toString()` |
| **`allowedSessionReplayRecordUserIds`** | 保留。迁移到 `postStartStrategy.ts`，用户白名单录制控制逻辑不变 |
| **`sessionReplayRecorder` / `rrwebOptions`** | 保留。configuration 类型定义和赋值均保留 |
| **`_shsnc_tracing_injected` 幂等保护** | 保留。XHR 请求头注入去重逻辑不变 |
| **`sncLogs` / `sncRum` 导出** | 保留。入口文件未受影响 |
| **`snc-client-token` 默认值** | 保留。proxy 文件未受影响 |

## 四、手动解决的冲突文件（8 个）

| 文件 | 处理方式 |
|------|---------|
| `packages/rum-core/src/domain/tracing/tracer.ts` | 适配新 `identifier.ts` 签名，`toDecimalString()` → `toString()`，`toPaddedHexadecimalString()` → 函数调用形式 |
| `packages/rum-core/src/domain/configuration/configuration.ts` | 保留自定义字段 + 集成 `traceSampleRate ?? 100`、`rulePsr` 计算 |
| `packages/rum/src/boot/recorderApi.ts` | 使用上游策略模式重构，`onRumStart` 接收 `userContextManager` 并传递 |
| `packages/rum/src/boot/postStartStrategy.ts` | 新增 `userContextManager` 参数，添加用户白名单录制控制订阅 |
| `packages/rum/src/boot/preStartStrategy.ts` | `shouldStartImmediately` 增加 `allowedSessionReplayRecordUserIds` 条件 |
| `tsconfig.base.json` | 添加 `skipLibCheck: true`（rrweb alpha 与 TS 5.6 类型不兼容） |
| `packages/rum/package.json` | 添加 `rrweb` + `@rrweb/all` 依赖 |
| `packages/rum-core/package.json` | 添加 `rrweb` 依赖 |

## 五、构建状态

所有 8 个子包构建通过，构建错误与原分支一致（rrweb alpha 类型问题通过 `skipLibCheck` 解决）。

## 六、上游完整 Commit 列表

```
984307dc5 v5.35.1
fbd8737f2 ⚡ [RUM-8353] throttle view update in set view context (#3338)
50b8074ad 🔧 do not merge v5 on staging
b6263ce60 v5.35.0
5f995a4ba ✨ [RUM-5001] introduce a `sessionPersistence` config option to force using local storage (#3244)
8faeb6420 Revert "👷 freeze canary deploy (#3238)" (#3252)
21975c792 💚 fix CI PR comment (#3250)
6fb4e3cd6 ✅ fix leak detection issues (#3245)
c4b604610 👷 Bump staging to staging-02
bfe603b24 👷 Update all non-major dependencies (#3240)
27671e8e9 👷 Update dependency webpack-cli to v6 (#3241)
294ac3b00 👷 Bump staging to staging-53
9861f5a2a 👷 Bump staging to staging-52
3baa5e887 feat: support custom schema on Electron (#3204)
724b20bf5 👷 freeze canary deploy (#3238)
a0e447e34 ♻️ move traceSampleRate default to config validation (#3197)
c57651905 v5.34.1 (#3233)
2a1b5fd90 ⚡️ [RUM-7650] Delay the viewport dimension collection (#3209)
166489ddc 🐛 AddError should support all instances of type Error (#3228)
db5520fb7 📦️ update typescript-eslint (#3192)
b9b259219 👷 Update all non-major dependencies (#3200)
770f83097 👷 [RUM-7634] Add deploy and source maps upload scripts tests (#3211)
8692f02ea 🐛 Fix unobserve error for non-Element parameter (#3218)
6f2527478 v5.34.0 (#3219)
38847d984 👷 Bump staging to staging-51
8c6c9d8fd 🐛 [RUM-6322] Use window.open observable (#3215)
518c07a32 ⚗️ ✨ [RUM-6868] implement consistent probabilistic trace sampling (#3186)
f87c2fef3 Test anonymous id on staging behind ff (#3206)
8c093ddc8 v5.33.0 (#3207)
50b10731a Revert "👷 freeze canary deploy (#3175)" (#3203)
9ce267c35 👷 Bump staging to staging-50
17b3cbbaa ♻️ [RUM-6813] Split the recorder API module (#3181)
2915926aa ✅ [RUM-6813]Fix recorder tests (#3191)
979043b17 👷 Update all non-major dependencies (#3157)
4ffe79698 👷 Bump staging to staging-49
0dfe31486 Adds a prepare script to @datadog/browser-rum-react (#3182)
1386574da ✨ [RUM-6182] don't start recording automatically when sample is 0 (#3162)
f59df7cb7 ✨ [RUM-6799] Add new delivery type property (#3166)
ed08cb2d6 👷 freeze canary deploy (#3175)
```
