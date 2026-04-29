# Phase D — Bunny 情绪表达 PRD

> **此文件是 phase-d-bunny-expression 分支的开发宪法。**
> 任何 AI 接手本分支工作时，必须先阅读这个文件，然后再写一行代码。
> 所有要求按重要性排序，违反任何一条都属于"仓促交工"。

---

## 0. 写在最前面的硬要求（不可越线）

### 0.1 分支与端口隔离 ⚠️

- **禁止在 `localhost:3000` 上开发或测试本分支的功能。**
  端口 3000 服务的是 `bunny-main-stable/` 这个 worktree，跑的是 `main` 分支稳定版，
  我女儿（用户的小朋友）一直在那个地址玩游戏。任何不稳定的改动都会破坏她的体验。
- **本分支的开发地址固定为 `localhost:3030`。**
  从仓库根目录 `bunny/` 启动：
  ```bash
  cd bunny
  NEXT_DIST_DIR=.next-dev-3030 npx next dev -p 3030
  ```
- **禁止改动 main 分支上的任何文件。**
  本分支的工作成果只通过 PR 合并回 main，绝对不允许直接在 main 工作树编辑。
- 如果接手的 AI 发现 3000 端口指向的是非 main 内容（例如有 phase-d 改动），
  必须先把 3000 切回 main，再继续开发。详细操作见 §10。

### 0.2 不允许仓促交工 🚫

- **如果做不到，就接着做下去，不要给用户一个"差不多"的版本。**
  用户原话："如果完不成，不能做到，一直开发下去，不要交工，可以来问我，
  讨论怎么样让它实现。不要给我仓促交工。"
- 遇到瓶颈先问用户，讨论方案；不要自己降低标准。
- "1:1 还原" 是硬指标，详见 §1。

### 0.3 视觉验证必须用 Playwright 截图

- 每完成一个动作 / 表情 / 交互，必须用 Playwright 在 `localhost:3030/preview/rig`
  截图给自己看，确认没有视觉 bug。文字描述不能代替肉眼验证。
- 默认对照物是 `public/assets/bunny/bunny_idle.png`。

---

## 1. 项目背景与已完成的关键里程碑

### 1.1 上下文：为什么放弃了"AI 帧动画"和"部件拼图"

最初尝试用 GPT Image 生成不同状态帧做定格动画，但 AI 生图不稳定，
毛发/眼睛每帧都有差异，无法保持一致性。

第二次尝试把兔子"肢解"成矢量部件（头/身/眼/耳/嘴/耳的不同形态等），
在前端拼合。但 AI 生成的 `bunny_idle.png` 有真实的毛绒纹理、阴影、
微小抗锯齿细节，矢量部件根本拼不出来。用户多次反馈"完全没有做到 1:1 还原"。

### 1.2 当前最终方案（已上线在 phase-d-bunny-expression 分支）

**整图为底 + 局部部件覆盖：**

1. 始终把 `bunny_idle.png` 作为**底层全画布渲染** —— idle 状态保证 100% 像素级 1:1。
2. 当表情需要改变嘴 / 眼时，**只在原位置覆盖那一小片对应的 PNG**。
   - 嘴部 PNG（mouth_closed / mouth_small_open / mouth_big_open）
     自带周围毛绒纹理，能干净覆盖底图原本的嘴。
   - 眼部 PNG（blink_left / blink_right）只是细的睫毛线，无法掩盖底图的睁眼。
     解决：先用一个 `radial-gradient` 的毛绒色斑点（fluffy patch）盖住睁眼，
     再画睫毛线。
3. **整图 transform** 处理整体的轻微动作（呼吸 / 听话时身体前倾 /
   兴奋时上跳），让整张兔子作为一个整体动起来。
4. **耳朵姿态、手臂姿态的切换**目前**不实现** —— 因为 `bunny_idle.png`
   底层已经画了原始耳和手，新姿态部件覆盖后会出现"双重耳/双重手"。
   要彻底解决需要派生 `idle_no_ears.png` / `idle_no_arms.png`（M3）。
   在那之前，相关表情（listening / shy / sleepy 等本来想配合耳朵姿态变化的）
   只通过 **嘴 + 眼 + 整图 transform** 来传达情绪即可。

### 1.3 已完成的产出

```
lib/config/bunny-rig.ts             — 23 个部件的 cx/cy/width/height + z-order 目录
lib/config/bunny-expressions.ts     — 12 种情绪 + status 映射 + 文本关键词分类
components/stage/bunny-rig.tsx      — 整图为底 + 嘴/眼覆盖的 BunnyRig 组件
app/preview/rig/page.tsx            — 1:1 验证三面板 + 12 表情目录
public/assets/bunny/bunny_parts/    — 23 张矢量部件 PNG（透明底）
```

验证结论（已通过 Playwright 截图肉眼确认）：
- ✅ idle 状态在三面板对比中**完全无影**，1:1 像素级还原
- ✅ 12 种表情切换时嘴 / 眼 / 整图位移均正确
- ⏳ 耳朵 / 手姿态切换：M3 派生图后再做

---

## 2. 本分支的核心任务：让兔子"活"起来

### 2.1 目标

让兔子在与孩子的语音对话中，**身体语言永远是主角**。
孩子说话时它在听、它在想、它在回答，每一个状态都有可见的肢体语言变化。
配合点击 / 触摸交互（戳一下、抚摸一下），让兔子真的像一只活的玩偶。

### 2.2 12 种情绪 / 状态（已在 `bunny-expressions.ts` 定义）

| 表情 ID    | 何时触发                       | 视觉特征                                                |
|-----------|-------------------------------|--------------------------------------------------------|
| idle      | 默认                          | 原图 100% 还原                                          |
| listening | 麦克风录音中                   | 嘴闭，整体身体前倾                                       |
| thinking  | LLM 调用中                     | 嘴闭，头部微转                                           |
| speaking  | TTS 播放中                     | 嘴随音量切（M2-D viseme），整图轻微节奏感                 |
| happy     | 笑声 / "好的" / "yes"          | 微弹跳                                                   |
| excited   | 关键字"生日"/"惊喜"/"surprise" | 嘴 big_open，整图上跳                                    |
| curious   | Bunny 主动提问 / 含 "?"        | 嘴闭，整图微转                                           |
| confused  | "听不清" / "huh"               | 嘴 small_open，整图微转                                  |
| shy       | "你好可爱" / "love you"        | 闭眼（fluffy patch + 睫毛），整图前倾贴近                 |
| sleepy    | 长停顿 / "晚安" / "tired"      | 闭眼 + 嘴闭，整图下沉                                    |
| tickled   | 点击 / 戳一下                   | 嘴 big_open，整图上跳                                    |
| petted    | 长按 / 拖拽抚摸                 | 闭眼 + 嘴 smile_tongue，整图上抬接近触摸                  |

### 2.3 路线图

| 里程碑 | 任务                                                            | 状态        |
|-------|----------------------------------------------------------------|-------------|
| M1-A  | 重写 BunnyRig：整图为底 + 局部覆盖                                | ✅ 已完成    |
| M1-B  | 嘴部覆盖位置精准对齐                                               | ✅ 已完成    |
| M1-C  | 眼部 fluffy patch + 睫毛覆盖                                      | ✅ 已完成    |
| M1-D  | Playwright 三面板验证 1:1                                         | ✅ 已完成    |
| M2-A  | 把 `expressionForStatus(status)` 接进 BunnyStage / 主页面          | 进行中      |
| M2-B  | 点击 / 长按交互 → tickled / petted（节流 + 防止误触发）              | 待办        |
| M2-C  | LLM 文字 → `expressionFromText(text)` 切换表情                    | 待办        |
| M2-D  | TTS 音频流到达后才触发嘴动 + 按音量切 mouth_*                      | 待办        |
| M3-A  | 用 Photoshop / 在线工具派生 `idle_no_ears.png`                    | 待办        |
| M3-B  | 用 Photoshop / 在线工具派生 `idle_no_arms.png`                    | 待办        |
| M3-C  | 解锁耳/手姿态切换在 BunnyRig 中                                    | 待办        |

---

## 3. 重要 Bug 规避（用户多次提到）

### 3.1 口型同步 bug：声音没到嘴已经在动

**当前状态：** API 返回文本时 BunnyStage 会立即切到 `speaking`，但音频还没开始播。
看到的现象是兔子在静默地张嘴。

**修复要求：** 必须等 audio stream 真正开始播放（`audio.play()` 后第一个
有效音量帧）才切到 `speaking` 表情和 viseme 驱动嘴动。
口型不需要精准对应音素，只要嘴跟着音量节奏起伏即可。

**实现位置：** `lib/audio/audio-bus.ts` 已经有 `BeforeAcquire/AfterRelease` 钩子，
利用 `AfterRelease`（或在 `audio.play()` resolve 后）发事件驱动 BunnyStage。

### 3.2 iPad 上点击麦克风后背景音乐和 TTS 都没声音

**这个问题已经在 main 分支修过（44055bb / f0fdab7 / 4c8c7d6）。**
phase-d 分支不要碰 audio-bus 的修复逻辑，只读取它的事件。

---

## 4. 不要做的事

- ❌ 不要改 `bunny-main-stable/` 这个 worktree。它是 main 分支的稳定运行实例。
- ❌ 不要改 `lib/audio/` 下的任何文件，除非 §3.1 明确要求。
- ❌ 不要为了"让代码更优雅"删除 `lib/config/bunny-rig.ts` 中暂时未用的部件目录
  （ear_pose_*, arm_*, cheek_*）。它们 M3 会用到。
- ❌ 不要再回到"用部件拼出兔子"的老路。已经验证不可行。
- ❌ 不要在没有 Playwright 截图验证的情况下声称表情"已实现"。
- ❌ 不要把进度推回到 main。本分支只在 phase-d-bunny-expression 上推进。

---

## 5. 沟通约定

- **回复用户必须用中文。**
- 不要给时间估计（"快"/"很久"/"两小时"等），用户体验为时间压力。
- 不要描述"工作量大小"。
- 涉及范围 / 取舍时，描述"包含什么"和"暂缓什么"，而不是"多少时间"。

---

## 6. 验证清单（每次交工前自己核对）

- [ ] 港口 3000 仍然指向 `bunny-main-stable/`，跑的是 main 分支稳定版
- [ ] 港口 3030 跑的是 phase-d-bunny-expression 当前 worktree
- [ ] `localhost:3030/preview/rig` 三面板显示 idle 像素级 1:1
- [ ] `localhost:3030/preview/rig` 12 表情都正确渲染
- [ ] `localhost:3030/`（主页）的兔子和 idle 引用完全一致（idle 状态）
- [ ] 主分支的 `app/page.tsx`、`components/stage/bunny-stage.tsx`、`lib/audio/`
      没有被改动（除非 §3.1 要求）
- [ ] git status 干净，所有改动都已提交到 phase-d-bunny-expression

---

## 7. 当前进度回顾（2026-04-29）

- ✅ M1 全部完成（1:1 还原 + 12 表情骨架）
- ⏳ M2-A 进行中：要把 expression 接进 BunnyStage 让兔子在真实对话中切表情
- ⏳ M2-B / M2-C / M2-D / M3 排队中

下一步：在 phase-d 分支上把 conversation status 的事件接到 BunnyStage 的
`expression` prop，让兔子在 listening / thinking / speaking 时身体语言会动。
具体做法见路线图 §2.3。

---

## 8. 项目结构提示（给接手 AI 看）

```
bunny/                                  ← 主开发树（phase-d-bunny-expression）
├── PHASE-D-PRD.md                      ← 你正在读的这个文件
├── PRD.md                              ← 整个 Bunny Companion 的总 PRD
├── app/
│   ├── page.tsx                        ← 主页面，渲染 BunnyStage
│   └── preview/rig/page.tsx            ← 1:1 验证 + 12 表情目录
├── components/stage/
│   ├── bunny-stage.tsx                 ← 主舞台（greeting / bunny / mic / caption）
│   └── bunny-rig.tsx                   ← BunnyRig 组件（整图为底 + 局部覆盖）
├── lib/
│   ├── audio/audio-bus.ts              ← 音频管理（不要乱改）
│   └── config/
│       ├── bunny-rig.ts                ← 部件目录（cx/cy/width/height）
│       └── bunny-expressions.ts        ← 12 表情 + status/text 映射
└── public/assets/bunny/
    ├── bunny_idle.png                  ← 整图底（不可缺失，1:1 还原靠它）
    └── bunny_parts/                    ← 23 张部件 PNG（透明底）

bunny-main-stable/                      ← main 分支 worktree（女儿玩的稳定版）
                                        ← 永远不要改这里的文件
                                        ← 跑在 localhost:3000
```

---

## 9. 历史失败教训（给接手 AI 的提醒）

1. **不要承诺时间估计** —— 用户多次提醒，违反会导致用户失去信任。
2. **不要"差不多就行"** —— 用户原话："如果不能还原，需要往上一层去思考方法可能性，
   任何方法，不计时间成本，直到 1:1 还原，切忌仓促交工。"
3. **不要改 main 分支** —— 用户多次强调 "不要影响主要的文件"。
4. **不要混淆端口** —— 用户女儿的体验在 3000 端口，不要污染。
5. **不要丢失上下文** —— 这就是写这份 PRD 的原因。即使切换 AI 也要看懂。

---

## 10. 应急操作手册

### 10.1 重新启动两套 dev server

```bash
# 杀掉所有 next dev
lsof -ti :3000 :3030 | xargs kill 2>/dev/null

# 启动 main（女儿玩的稳定版）
cd "/Users/xiaoxiannv/Desktop/vibe coding/bunny-main-stable"
NEXT_DIST_DIR=.next-dev npx next dev -p 3000 > /tmp/bunny-main-dev.log 2>&1 &

# 启动 phase-d（你开发的分支）
cd "/Users/xiaoxiannv/Desktop/vibe coding/bunny"
NEXT_DIST_DIR=.next-dev-3030 npx next dev -p 3030 > /tmp/bunny-feature-dev.log 2>&1 &
```

### 10.2 如果 worktree 丢失

```bash
cd "/Users/xiaoxiannv/Desktop/vibe coding/bunny"
git worktree add ../bunny-main-stable main
ln -s "$PWD/node_modules" ../bunny-main-stable/node_modules
```

### 10.3 如果发现 main 文件被误改

```bash
# 在 bunny-main-stable 下执行
cd "/Users/xiaoxiannv/Desktop/vibe coding/bunny-main-stable"
git restore .
```
