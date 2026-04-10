import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';

const toolbarChips = [
  'Slash commands',
  'Bubble menu',
  'Chapter stats',
  'Search highlight',
  'Page-break style',
];

export function EditorPanel() {
  return (
    <Panel
      title="Primary writing stage"
      subtitle="中栏维持最高视觉权重，给 lane-3 富文本编辑器与章节工作流提供稳定挂载位。"
      badge={<Badge tone="neutral">Editor</Badge>}
    >
      <div className="editor-stage">
        <div className="editor-toolbar">
          {toolbarChips.map((chip) => (
            <span key={chip} className="toolbar-chip">
              {chip}
            </span>
          ))}
        </div>

        <div className="editor-prose">
          <h2>第二十三章：月潮越过书脊</h2>
          <p>
            她把设定树里最后一条
            <span className="editor-highlight"> 世界规则 </span>
            拖进上下文槽后，右栏的提示词突然安静下来。所有多余的模式开关都被拿掉，
            页面只剩下写作本身：左边是结构，中间是正文，右边是推理与帮助。
          </p>
          <p>
            这就是 lane-2 的职责——先把容器和节奏做对，再让章节、AI、快照沿着同一套
            shadow-border 语言长出来，而不是让功能在 dashboard 化的碎片里互相争抢。
          </p>
          <p>
            当后续 lane 接入真正的数据与交互时，这块区域仍然应该维持同样的排版密度、
            视觉节奏与专注感。
          </p>
        </div>
      </div>
    </Panel>
  );
}
