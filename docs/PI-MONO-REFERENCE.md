# Pi Mono (@mariozechner/pi-agent-core) 功能参考

CatNovel 使用的 AI 对话引擎 `@mariozechner/pi-agent-core` 的完整功能参考。

## 核心类

### Agent

有状态对话代理，支持工具执行和事件流。

```typescript
import { Agent } from "@mariozechner/pi-agent-core";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are helpful.",
    model: getModel("openai", "gpt-4o"),
  },
});
```

## 消息发送

### prompt()

发送用户消息并开始对话。

```typescript
// 文本消息
await agent.prompt("Hello!");

// 带图片
await agent.prompt("Describe this", [
  { type: "image", data: base64Data, mimeType: "image/jpeg" }
]);

// 结构化消息
await agent.prompt({
  role: "user",
  content: "Hello",
  timestamp: Date.now()
});

// 批量消息
await agent.prompt([
  { role: "user", content: "First", timestamp: Date.now() },
  { role: "user", content: "Second", timestamp: Date.now() }
]);
```

### continue()

从当前上下文继续（续写被中断的回复）。

**使用场景：**
- 用户中途点击"停止"
- 网络中断后恢复

**要求：**最后一条消息必须是 `user` 或 `toolResult`。

```typescript
try {
  await agent.prompt("Generate long content");
} catch (error) {
  // 用户中断
}

// 续写
await agent.continue();
```

**事件序列：**
```
continue()
├─ agent_start
├─ turn_start
├─ message_start   { assistant message }
├─ message_update...
├─ message_end
├─ turn_end
└─ agent_end
```

### steer()

**工具执行期间**插入引导消息，改变对话方向。

**特点：**
- 可以打断正在运行的工具
- 插入的消息会被优先处理

```typescript
// 用户想改变方向
agent.steer({
  role: "user",
  content: "Stop! Do this instead.",
  timestamp: Date.now(),
});
```

**处理模式：**
```typescript
agent.steeringMode = "one-at-a-time"; // 默认，一次处理一条
agent.steeringMode = "all";           // 批量处理所有队列消息
```

### followUp()

**对话结束后**自动追加后续任务。

**特点：**
- 只在 Agent 将要停止时触发
- 适合自动追问、总结等场景

```typescript
// AI 回答完"分析代码"后，自动追问总结
agent.followUp({
  role: "user",
  content: "用一句话总结上述分析",
  timestamp: Date.now(),
});
```

**处理模式：**
```typescript
agent.followUpMode = "one-at-a-time"; // 默认
agent.followUpMode = "all";
```

### abort()

中止当前运行。

```typescript
agent.abort(); // 立即终止生成和工具执行
```

### waitForIdle()

等待当前运行完成。

```typescript
await agent.waitForIdle(); // 包含所有事件监听器完成
```

### reset()

重置 Agent 状态。

```typescript
agent.reset();
// 清除：messages, streamingMessage, errorMessage, pendingToolCalls
// 保留：systemPrompt, model, tools, thinkingLevel
```

## 状态管理

### 可修改状态

```typescript
// 系统提示词
agent.state.systemPrompt = "New instructions";

// 切换模型
agent.state.model = getModel("anthropic", "claude-sonnet-4");

// 推理级别 (OpenAI o1/o3 等)
agent.state.thinkingLevel = "medium"; // off/minimal/low/medium/high/xhigh

// 工具列表
agent.state.tools = [readFileTool, writeFileTool];

// 完整替换消息历史（会复制数组）
agent.state.messages = newMessages;
agent.state.messages.push(newMessage);

// 其他配置
agent.sessionId = "session-123";      // 用于提供商缓存
agent.thinkingBudgets = {             // 自定义推理预算
  minimal: 128,
  low: 512,
  medium: 1024,
  high: 2048,
};
agent.toolExecution = "parallel";      // 或 "sequential"
```

### 只读状态

```typescript
agent.state.isStreaming;        // 是否正在生成
agent.state.streamingMessage;     // 当前流式消息（部分）
agent.state.pendingToolCalls;     // 待执行工具调用 Set
agent.state.errorMessage;         // 错误信息
```

## 消息队列管理

### 队列操作

```typescript
// 清空队列
agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();

// 检查队列状态
const hasQueued = agent.hasQueuedMessages();
const steeringMode = agent.steeringMode;
const followUpMode = agent.followUpMode;
```

## 事件系统

### 订阅事件

```typescript
const unsubscribe = agent.subscribe((event, signal) => {
  switch (event.type) {
    case "agent_start":
      console.log("开始");
      break;
    case "message_update":
      // 流式文本更新
      const delta = event.assistantMessageEvent.delta;
      process.stdout.write(delta);
      break;
    case "agent_end":
      console.log("结束");
      break;
  }
});

// 取消订阅
unsubscribe();
```

### 事件类型

| 事件 | 说明 | 关键数据 |
|------|------|---------|
| `agent_start` | 开始处理 | - |
| `agent_end` | 完成（最后事件） | messages[] |
| `turn_start` | 新对话轮次开始 | - |
| `turn_end` | 轮次完成 | message, toolResults[] |
| `message_start` | 消息开始 | message |
| `message_update` | **仅 Assistant**，流式更新 | assistantMessageEvent.delta |
| `message_end` | 消息完成 | message |
| `tool_execution_start` | 工具开始 | toolCallId, toolName |
| `tool_execution_update` | 工具流式更新 | partialResult |
| `tool_execution_end` | 工具完成 | toolCallId, result |
| `ai_error` | 错误 | error |

### 事件处理特性

- 监听器按**注册顺序**执行
- 监听器可以是**异步**的（Promise）
- `agent_end` 会等待所有监听器完成
- 监听器接收 `AbortSignal` 用于取消长时间操作

## 高级配置

### convertToLlm()

**必需。**将 `AgentMessage[]` 转换为 LLM 可理解的格式。

```typescript
const agent = new Agent({
  convertToLlm: (messages) => messages.filter(m => 
    m.role === "user" || m.role === "assistant" || m.role === "toolResult"
  ),
});
```

**执行流程：**
```
AgentMessage[] → convertToLlm() → Message[] → LLM
```

### transformContext()

**可选。**动态修改消息列表（压缩、注入上下文）。

**CatNovel 使用：**注入工作区上下文（章节、设定等）。

```typescript
const agent = new Agent({
  transformContext: async (messages, signal) => {
    // 修剪旧消息
    const recent = messages.slice(-10);
    
    // 注入外部上下文
    const context = await fetchContext();
    const contextMsg = {
      role: "user",
      content: `Context: ${context}`,
      timestamp: Date.now(),
    };
    
    return [contextMsg, ...recent];
  },
});
```

**执行流程：**
```
AgentMessage[] → transformContext() → AgentMessage[] → convertToLlm() → LLM
```

### beforeToolCall()

**可选。**工具调用前钩子，可阻止执行。

**返回类型：**
```typescript
type BeforeToolCallResult = 
  | undefined                    // 继续执行
  | { block: false }             // 继续（显式）
  | { block: true; reason: string }; // 阻止
```

**使用场景：**

```typescript
const agent = new Agent({
  beforeToolCall: async ({ toolCall, args }) => {
    // 权限控制
    if (toolCall.name === "delete_file") {
      if (args.path.includes("/system/")) {
        return { 
          block: true, 
          reason: "不能删除系统文件" 
        };
      }
    }
    
    // 危险命令检查
    if (args.code?.includes("rm -rf /")) {
      return { block: true, reason: "检测到危险命令" };
    }
    
    // 放行
    return undefined;
  },
});
```

### afterToolCall()

**可选。**工具调用后钩子，可修改结果。

```typescript
const agent = new Agent({
  afterToolCall: async ({ toolCall, result, isError }) => {
    // 添加审计标记
    return { 
      details: { 
        ...result.details, 
        audited: true,
        timestamp: Date.now()
      } 
    };
  },
});
```

## 工具定义

### AgentTool

```typescript
import { Type } from "@sinclair/typebox";

const readFileTool: AgentTool = {
  name: "read_file",              // 唯一标识
  label: "Read File",             // UI 显示名称
  description: "读取文件内容",
  parameters: Type.Object({
    path: Type.String({ description: "文件路径" }),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    // 可选：流式进度更新
    onUpdate?.({
      content: [{ type: "text", text: "读取中..." }],
      details: {}
    });
    
    const content = await fs.readFile(params.path, "utf-8");
    
    return {
      content: [{ type: "text", text: content }],
      details: { path: params.path, size: content.length }
    };
  },
};
```

### 错误处理

**必须抛出错误表示失败**，不要返回错误内容：

```typescript
execute: async (toolCallId, params) => {
  if (!fs.existsSync(params.path)) {
    throw new Error(`文件不存在: ${params.path}`);
  }
  return { content: [{ type: "text", text: "..." }] };
}
```

### 工具执行模式

```typescript
agent.toolExecution = "parallel";    // 默认，并行执行
agent.toolExecution = "sequential";    // 顺序执行
```

## 代理模式（Proxy）

用于浏览器应用通过后端代理：

```typescript
import { streamProxy } from "@mariozechner/pi-agent-core";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: "...",
      proxyUrl: "https://your-server.com",
    }),
});
```

## 底层 API

不使用 Agent 类，直接控制：

```typescript
import { agentLoop, agentLoopContinue } from "@mariozechner/pi-agent-core";

// 基础对话
for await (const event of agentLoop([userMessage], context, config)) {
  console.log(event.type);
}

// 继续对话
for await (const event of agentLoopContinue(context, config)) {
  console.log(event.type);
}
```

**警告：**底层流是观察性的，不等待事件处理器完成就继续。如果需要屏障语义，使用 `Agent` 类。

## 自定义消息类型

通过 TypeScript 声明合并扩展：

```typescript
declare module "@mariozechner/pi-agent-core" {
  interface CustomAgentMessages {
    notification: { 
      role: "notification"; 
      text: string; 
      timestamp: number 
    };
  }
}

// 现在可以使用
const msg: AgentMessage = { 
  role: "notification", 
  text: "Info", 
  timestamp: Date.now() 
};
```

处理自定义类型：

```typescript
const agent = new Agent({
  convertToLlm: (messages) => messages.flatMap(m => {
    if (m.role === "notification") return []; // 过滤掉
    return [m];
  }),
});
```

## CatNovel 使用概况

| 功能 | 使用状态 | 用途 |
|------|---------|------|
| `prompt()` | ✅ 使用 | 发送用户消息 |
| `continue()` | ❌ 未使用 | 场景不匹配（用版本替换而非续写） |
| `steer()` | ❌ 未使用 | 需要长连接 |
| `followUp()` | ❌ 未使用 | 需要长连接 |
| `transformContext()` | ✅ 使用 | 注入工作区上下文 |
| `beforeToolCall` | ❌ 未使用 | 暂无权限控制需求 |
| `afterToolCall` | ❌ 未使用 | 暂无审计需求 |
| `subscribe()` | ✅ 使用 | 事件监听 |
| `reset()` | ✅ 使用 | 重置状态 |
| `waitForIdle()` | ✅ 使用 | 测试等待 |
| Tools | ❌ 未使用 | CatNovel 当前无工具 |

## 参考链接

- [GitHub Repository](https://github.com/badlogic/pi-mono)
- [npm Package](https://www.npmjs.com/package/@mariozechner/pi-agent-core)
