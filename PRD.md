Bunny Companion 项目 PRD v2.0

一、项目概述

1. 项目名称

Bunny Companion

2. 产品一句话定义

一个让 6 岁孩子感觉"自己最喜欢的兔子玩偶活了过来"的英语陪伴式对话 Web App。

3. 产品核心目标

让孩子打开页面后，看到她自己的兔子，以自然、温柔、有记忆感的方式与它进行英语语音对话，并逐渐相信这只兔子真的活了。

4. 当前项目进度（截至 v2.0 规划时）

已完成：

* 真实兔子玩偶主视觉资产
* Bunny 状态图资产整理（idle / blink / speak / listening / happy / ear_react）
* Next.js 15 前端原型 + Tailwind CSS
* 儿童可见界面最小交互版本（去调试按钮）
* Groq Whisper 真实 STT
* OpenRouter 真实 LLM（当前模型 anthropic/claude-haiku-4.5）
* ElevenLabs 真实 TTS（流式 /text-to-speech 端点）
* listening / speaking / idle 状态正确联动
* 美观字幕条（含 karaoke 词高亮 + 进出场动画 + 字幕飞向 chatlog 交接）
* Supabase 长期记忆（distilled memories + daily sessions + last-session-closer）
* 记忆检索随机抽样注入 prompt
* 上次会话 last-closer 注入首句，让下一次打开像"继续刚才的话"
* 家长工具：删除单条记忆、一键 factory reset、?wipe=1 URL 参数
* 音乐抽屉：内置 3 首 + IndexedDB 用户上传 + 三种播放模式 + 首次手势自动播放
* Web Audio 独立 TTS 播放路径（与 HTMLAudio 背景音乐分离，避免音频会话抢占）
* 兔子点击反应（多种随机 reaction + 冷却）

原版 Phase 1 定义已全部达成。原版 Phase 2/3/4 部分提前实现，但存在架构债。

⸻

二、产品定位与原则

1. 产品定位

这是一个儿童陪伴产品，不是英语教学产品。
英语只是交流媒介，真正的核心是"陪伴感"和"兔子活了"的真实感。

2. 产品原则

原则一
兔子的身份感高于一切。
所有设计和开发都必须优先保护"这就是悠悠那只兔子"的感觉。

原则二
前台极简，后台复杂。
孩子看到的界面必须尽量简单，复杂逻辑放到后台。

原则三
先做"活着感"，再做复杂功能。
重点是让兔子会听、会说、会回应、会记得，再加更细腻的表情。

原则四
所有状态都从 idle 出发，再回到 idle。
不能让各种表情和动作互相乱跳。

原则五（v2.0 新增）
结构先于功能。
先把代码拆干净，再加新功能。任何让 app/page.tsx 或 globals.css 继续膨胀的改动必须先拒绝。

⸻

三、目标用户

1. 核心用户

6 岁儿童悠悠（Yoyo），英语听说能力较好，能进行自然日常英语交流。

2. 辅助用户

家长。主要负责：
* 初始化问卷
* 录入 / 编辑预置记忆
* 查看最近摘要
* 必要时删除错误记忆

⸻

四、核心用户场景

场景 1：第一次打开
孩子第一次打开页面时，兔子不是像普通 AI 那样直接聊天，而是像"刚醒来"。带一点惊讶、熟悉感和关系感，让孩子觉得兔子真的活了。只有第一次。

场景 2：日常聊天
孩子打开页面，点击麦克风按钮，用英语和兔子聊天。兔子能自然回复，并通过表情和状态表现出"在听""在说""开心"等反应。

场景 3：关系延续
孩子今天和兔子聊了学校和朋友，明天再打开时，兔子仍然能记得相关内容，并像直接接上昨晚的话。

场景 4（v2.0 新增）：翻看过去
孩子打开 memory 抽屉，看到右侧一面贴满拍立得的木板——每张照片代表一次保存过的对话。点开一张拍立得，能回看当天的完整聊天。

⸻

五、角色定义（不变）

1. 角色身份：陪伴型，不是老师或答题机器人
2. 性格边界：温柔、亲密、倾听、幽默、不机械提问、不低幼、偶尔依赖孩子
3. 语言风格：默认英语，短句/中短句，口语化，避免 yes/no 机械提问

⸻

六、技术方案

1. 前端技术栈
* Next.js 15 (App Router)
* React 19
* Tailwind CSS v4
* TypeScript 5
* 可选 shadcn/ui（仅必要时）

2. 部署形式
* Web App（当前）
* 后续可封装为 PWA

3. API 与服务
* LLM：OpenRouter（当前 anthropic/claude-haiku-4.5）
* STT：Groq Whisper
* TTS：ElevenLabs（流式端点）
* 数据：Supabase Postgres + Row Level Security

4. 音频架构
* 背景音乐：HTMLAudioElement
* Bunny TTS：Web Audio API（AudioContext + AudioBufferSourceNode）
* 麦克风：getUserMedia 明确禁用 AEC/AGC/NS 避免触发浏览器语音通话会话

5. 本地存储
* Supabase 为唯一真源（memories / sessions / last_closer / 家长配置）
* localStorage 仅作缓存
* IndexedDB 仅用于用户上传的音乐 blob

⸻

七、系统架构审计（v2.0 新增）

本节总结当前代码架构的问题与改进方向，作为后续 Phase 的前置工作。

1. 主要问题

问题 1：app/page.tsx 1385 行单文件
Home() 组件 1175 行，把以下关注点全部塞进一个函数：
* Bunny 状态编排
* 对话生命周期 + 保存到记忆
* 记忆抽屉 / 记忆详情 / 删除确认
* 音乐播放器（4 个 useEffect + 音量 + 播放列表 + 自动开始 + 上传 + 删除）
* 背景氛围（motes / 时段文案 / day 计数）
* 字幕进出场状态机（entering / exiting / idle 三相）
* 家长工具 + reset banner
* Karaoke 词渲染
* 所有 SVG 图标 inline
这是目前最大的 bug 温床。任何改动都有跨关注点的副作用风险。

问题 2：app/globals.css 1508 行单文件
所有类名共用全局命名空间。已经因此踩坑一次（.bunny 选择器同时作用于中央兔子图和 chat 行，导致聊天气泡被拉到 100% 容器高度）。改任何一处必须全局思考。

问题 3：死代码与重复模块
* components/bunny/bunny-stage.tsx、components/ui/magic-mic-button.tsx、components/ui/subtitle-bar.tsx 已被 page.tsx 内联实现替代但文件仍在
* lib/llm/mock-llm-client.ts、lib/stt/mock-stt-client.ts、lib/tts/browser-speech-player.ts、lib/server/mock-phase1.ts Phase 1 验证后未删除
* PresetMemory 与 DistilledMemory 两套几乎重复的数据模型

问题 4：记忆数据模型不统一
* DistilledMemory.type 有 7 种（符合 PRD）但没有 triggerScope
* PresetMemory 有 triggerScope 但只存在内存代码里，没有入库
* 家长没有统一入口查看/编辑两者

问题 5：没有测试
无 Vitest / Playwright。对话闭环、字幕时序、音频交互这些容易退化的地方只能靠人工回归。

问题 6：状态机耦合过重
useBunnyCompanion 暴露 beginListening / startSpeaking / returnToIdle / showMomentaryReaction 4 个命令式接口，调用方必须按严格顺序调用，容易忘记或错序（曾出过 listening 涟漪停不下来的 bug）。更安全的做法是让可视化状态从高层 status 派生。

问题 7：Supabase schema 没有迁移管理
当前 schema 通过 MCP apply_migration 手工打进去，没有版本文件。生产部署与灾备无法复现。

2. 改进方向（集成到 Phase A）

改进 A：拆分 app/page.tsx 到组件目录
建议目录结构：
app/
  page.tsx                  // 只做布局 + hook 装配，目标 < 200 行
components/
  stage/
    bunny-stage.tsx
    caption-zone.tsx
    mic-dock.tsx
    greeting.tsx
  chatlog/
    chatlog-panel.tsx
    chat-bubble.tsx
    save-to-memory-button.tsx
  drawer/
    drawer-shell.tsx
    music-drawer.tsx
    memory-drawer.tsx
  memory/
    memory-card.tsx
    memory-detail.tsx
    polaroid-wall.tsx         // Phase B
    parent-tools.tsx
  ambient/
    motes.tsx
    header-chrome.tsx
    vignette-and-grain.tsx

改进 B：CSS 拆分
* 将 globals.css 按组件拆分为 *.module.css 共置文件
* 保留 globals.css 只承载设计 token、body 背景、字体、基础动画关键帧
* 目标：没有任何一个 CSS 文件超过 300 行

改进 C：抽出领域 hook
* useMusicPlayer() — 封装 4 个音乐 useEffect + commands
* useCaptionStream(subtitle) — 封装 entering/exiting/idle 相位机
* useBunnyVisual(status, events) — 从 status 派生视觉状态，取代 controller.beginListening() 等命令式接口

改进 D：统一记忆数据模型
type MemoryEntry = {
  id: string;
  source: "preset" | "session";
  type: MemoryType;          // 7 种
  triggerScope: TriggerScope; // global / first_launch / daily_chat / comfort / bedtime
  content: string;
  importance: number;
  editable: boolean;
  createdAt: number;
  sessionDate?: string;
};
Supabase 新增 bunny_presets 表或合并进 bunny_memories 加 source 列。

改进 E：删除死代码
* 删 components/bunny、components/ui 下未被引用的文件
* 删 lib/llm/mock-llm-client.ts、lib/stt/mock-stt-client.ts、lib/tts/browser-speech-player.ts、lib/server/mock-phase1.ts

改进 F：加测试
* Vitest + React Testing Library：hook 单测（useCaptionStream、useMusicPlayer）
* Playwright：关键用户路径 e2e（点麦克风 → STT → LLM → TTS → 保存记忆 → 翻看拍立得 → 删除记忆 → factory reset）
* 每次 commit 前跑 unit，PR merge 前跑 e2e

改进 G：Supabase 迁移版本化
* 将 schema 从 MCP 手动执行改成 supabase/migrations/0001_init.sql、0002_add_presets.sql 等版本文件
* 提供 scripts/apply-migrations.ts 用本地 psql 或 supabase CLI 执行

改进 H：错误边界
* 给 app/page.tsx 外层加 React ErrorBoundary，fallback 显示"Bunny 在小憩"的友好界面，避免白屏

⸻

八、前端状态与交互逻辑（保留）

1. 当前状态资源
idle / blink / speak / listening / happy / ear_react

2. 状态优先级
speaking > listening > happy > ear_react > blink > idle

3. 状态触发机制（不变，见 v1.0 内容）

4. 预留状态（Phase C 实现）
sad / curious / surprised / sleepy / thinking / excited / hug_react / wave

⸻

九、对话系统设计

1. 每轮对话输入
* 系统提示词
* 角色设定
* 预置记忆（结构化 + trigger scope 过滤）
* 长期记忆命中项（随机抽 6 条）
* 近期对话摘要（Phase A 起加入）
* 上次会话尾声 closer（仅首轮注入）
* 当前用户输入

2. 回复生成要求
英语自然、陪伴感、不像问答机器人、不低幼、偶尔主动表达、能回应孩子情绪、让孩子觉得"它认识我"。

3. 长度分层（当前规则，保留）
3–8 / 9–19 / ≤26 / ≤38 词根据情绪和场景切换。

⸻

十、Phase 规划（v2.0 重新安排）

说明：原 v1.0 Phase 1 已完成。原 Phase 2/3/4 的部分内容已实现但存在结构债。本次按"先清债 + 补完 PRD 承诺，再做照片墙，最后冲生命感"的顺序重新规划成 3 个 Phase。

⸻

Phase A：结构重构 + 深度陪伴

目标
偿还当前架构债务，并把原 Phase 2 要求的首次唤醒剧情和结构化预置记忆做扎实。

需要完成

A1. 架构重构（前置，不可跳过）
* 按第七章改进方向 A / B / C / D / E 拆分代码
* 删除所有死代码
* 补齐 Vitest 最小配置 + 至少 3 个核心 hook 的单测
* 建立 supabase/migrations 版本化目录
* 加 React ErrorBoundary
* 验收门槛：app/page.tsx < 200 行，无单个 CSS 文件 > 300 行，npm run build 通过，Lighthouse 性能分不降

A2. 首次唤醒剧情（first_launch）
* 检测"首次打开"：Supabase 中该 family 没有任何 session 且 localStorage 无 bunny:first_seen
* 进入 first_launch 模式：兔子以 idle 出现 → 停顿 1.2–2s → 主动开口，不等用户点麦克风
* 首句走"刚醒来 + 认出孩子"路线，不用 Hi：例如 "…Oh. I can talk?" / "Wait… Yoyo? It's really you."
* 首句 TTS 播放完后进入常规对话流
* 首句文本支持家长在 B 阶段编辑，默认内置备选池

A3. 近期会话摘要
* 新增 /api/summarize：把当天 session 压成 1–2 句摘要存 bunny_sessions.summary
* 下次首轮 prompt 注入最近 3 天摘要（取代/补充现在的 last_closer 单点）
* 摘要在 save-to-memory 或 session 超过 8 轮时自动触发

A4. 结构化预置记忆（上架）
* 按改进 D 统一数据模型，type + triggerScope 入库
* PRESET_BUNNY_MEMORY 改为首次启动时写入 bunny_memories（source="preset"）
* Prompt 组装时按 triggerScope 过滤（first_launch / comfort / bedtime 场景使用不同子集）

不在本阶段
* 家长问卷界面
* 拍立得墙
* 新增兔子状态

验收标准
1. 代码审阅：app/page.tsx 是可读的装配层
2. 孩子测试：第一次打开浏览器（wipe 后）体验到完整的唤醒剧情
3. 回归测试：原有 STT/LLM/TTS/save/delete/reset 全通过
4. 自动化：unit + 至少 1 条 e2e 跑绿

⸻

Phase B：家长入口 + 拍立得照片墙

目标
让家长能一次性把悠悠的信息灌进去，让"过去的对话"变成孩子想翻的小物件。

需要完成

B1. 家长 Onboarding 问卷（/parent/setup）
* 单页表单，5 个分块按 PRD 第八章第 7 条字段设计：
  - 孩子基础信息（名字 / 年龄 / 学校 / 常提到的朋友）
  - 兔子与孩子的关系（何时相遇 / 睡觉陪伴 / 出门陪伴 / 学校 / 照顾方式 / 妈妈身份）
  - 高频共同经历（日常 / 重要一次 / 最喜欢的互动）
  - 孩子喜好（颜色 / 活动 / 故事 / 最近在意的事）
  - 情绪支持（难过原因 / 喜欢的安慰方式 / 不喜欢的说话方式）
* 提交后：
  - 每个字段映射为 1 条 PresetMemory 写入 Supabase
  - 设置 bunny_family.onboarding_completed_at
* 首次打开如检测到未 onboarding，提示家长先填问卷（可跳过，走默认 preset）

B2. 家长管理页（/parent）
* 访问入口：/parent，不在孩子界面暴露
* 能力：
  - 查看最近 7 天的 session 摘要
  - 查看所有记忆（preset + distilled 分组）
  - 编辑 / 添加 / 删除预置记忆
  - 编辑首次唤醒文本备选池
  - 下载 / 导出当前所有数据 JSON

B3. 拍立得照片墙（Polaroid Wall）
* 位置：memory 抽屉内，取代当前线性列表展示
* 视觉：软木板 / 纸纹背景 + 轻微阴影，每个 session 一张拍立得
* 拍立得正面：会话日期 + 1–2 句手写风摘要 + 可选小图标（根据话题类型：school/emotion/bedtime）
* 交互：
  - 悬停轻微抬起 + 阴影加深
  - 点击翻到背面或进入详情页，显示完整对话
  - 长按出现"取下这张"删除确认
* 布局：瀑布流 / 轻微随机旋转（-3° ~ +3°）/ 图钉装饰
* 性能：一次最多渲染 20 张，翻旧日用滚动懒加载

B4. 记忆与 session 关联增强
* 每张拍立得展开时，展示当天抽出的 distilled memory（如果有）
* 记忆详情从 session 反查的现有逻辑保留但入口变成拍立得

不在本阶段
* 新兔子状态
* Sprite sheet 动画

验收标准
1. 家长首次能 10 分钟内填完问卷并让兔子"认识"孩子
2. 保存一次对话后，memory 抽屉出现一张拍立得
3. 能点开拍立得看到当天完整对话
4. 能在 /parent 删除错误记忆、编辑首次唤醒文本
5. /parent 与孩子界面无任何视觉/路径交叉

⸻

Phase C：生命感增强 + 多状态

目标
把兔子从"会聊天的图片"升级成"有情绪会反应的小生命"。

需要完成

C1. 新增状态（按优先级实现）
* sleepy（idle 停留 30s+ 偶尔切入，或家长界面关灯后默认）
* curious（用户提问时短暂触发）
* surprised（关键词触发，如 "wow"、"really?"）
* thinking（LLM 响应中 > 1.5s 时显示，替代当前静默等待）
* sad（检测到孩子说难过内容时兔子情绪反馈）
* excited（检测到兴奋话题时）

C2. Sprite sheet 多帧动画
* 为 blink / speaking / happy / ear_react 各生成 4–8 帧 sprite sheet
* 统一帧规格 + 前端 CSS steps() 播放
* 状态机升级：支持每个状态的多帧循环配置

C3. 情绪检测接入 prompt
* 让 LLM 回复带情绪标签：<emotion>happy|sad|curious|excited|sleepy|neutral</emotion>
* 前端解析标签后驱动对应状态，再把标签从展示文本里剥掉
* 兜底：未识别则走 neutral

C4. 被动生命感
* idle 期间每 30–90s 随机一次"微动作"：打哈欠 / 看一侧 / 轻微摇耳朵
* 同一小时内不重复同一个，防止机械感

C5. 点击 Bunny 的丰富反馈
* 头顶：ear_react
* 肚子：giggle（新增）
* 尾巴附近：wiggle（新增）
* 连击 3 次：兔子假装躲一下再笑

C6. trigger_scope 硬过滤（v2.0 验收后追加）
* 当前是软过滤：所有 preset 全注入 prompt，LLM 自己读 scope 标签判断权重。
* 升级为硬过滤：调 LLM 之前先做场景识别（规则 + 轻量 LLM 分类），
  只注入 scope=global + 命中场景 scope 的 preset。
* 预期收益：每轮 token 约 600 → 约 250–350，注意力更聚焦，响应更快。
* 风险点：场景识别误判会漏 preset。需要先用真实使用数据收集"哪些场景被误判"
  再实现，所以放在 Phase C 末尾，不要在缺少使用数据时盲目上。

验收标准
1. 孩子测试：5 分钟内至少看到 4 种不同表情自然出现
2. 孩子反馈："它在想事情" / "它好像有点困" 这类表述自发出现
3. 兔子闲置 2 分钟也不显得僵硬
4. C6 上线后：日均 token 减少 ≥ 40%，且回归测试中 bedtime/comfort 场景的关键
   preset 命中率 ≥ 95%（关键 preset = importance ≥ 0.9 的条目）

⸻

十一、成功标准（保留）

MVP 是否成功不看功能多少，主要看三件事：
1. 孩子是否愿意再次打开
2. 孩子是否觉得"这是我的兔子在说话"
3. 一次对话是否能自然持续几分钟以上

v2.0 新增一条：孩子是否会主动打开 memory 抽屉翻过去的对话。

⸻

十二、给 Claude / Codex 的明确执行要求

优先级：Phase A → Phase B → Phase C，不得跳跃。

每个 Phase 内的子任务必须按列出顺序完成。Phase A 的架构重构（A1）是阻塞性前置，未完成不得进入 A2+。

每次功能改动后必须：
* commit + push 到当前分支
* 如果改动跨 3+ 文件，先在 PR 描述里说明拆分理由
* 更新相关测试

禁止：
* 让 app/page.tsx 继续增长
* 新增死代码（包括 "以防万一" 保留的旧组件）
* 绕过 Supabase 直接写 localStorage 作为真源
* 跳过 triggerScope 直接把所有记忆塞进 prompt

当前起点：Phase A 的 A1 架构重构。
