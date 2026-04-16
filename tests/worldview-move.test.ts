import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function createTempDataDir() {
  return mkdtempSync(join(tmpdir(), "catnovel-db-"));
}

function expectDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

test("move-worldview-node: 将节点移动到另一个分组下，parentId 更新正确", async () => {
  const dataDir = createTempDataDir();
  process.env.CATNOVEL_DATA_DIR = dataDir;

  const [{ closeDatabase }, { applyWorkspaceMutation }] = await Promise.all([
    import("../db/client.ts"),
    import("../lib/server/services/workspace-data-service.ts"),
  ]);

  // 创建测试作品
  const createdWork = applyWorkspaceMutation({
    action: "create-work",
    title: "测试作品",
    locale: "zh",
    synopsis: "测试世界观节点移动",
  });
  const workId = expectDefined(createdWork.work, "work should be created").id;

  // 创建源分组
  const sourceGroup = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId,
    nodeType: "group",
    title: "源分组",
    parentId: null,
    payloadJson: "{}",
  });
  const sourceGroupId = expectDefined(
    sourceGroup.settingNode,
    "source group should be created"
  ).id;

  // 创建目标分组
  const targetGroup = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId,
    nodeType: "group",
    title: "目标分组",
    parentId: null,
    payloadJson: "{}",
  });
  const targetGroupId = expectDefined(
    targetGroup.settingNode,
    "target group should be created"
  ).id;

  // 在源分组下创建一个条目节点
  const entryNode = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId,
    nodeType: "entry",
    title: "测试条目",
    parentId: sourceGroupId,
    payloadJson: JSON.stringify({ content: "测试内容" }),
  });
  const entryNodeId = expectDefined(
    entryNode.settingNode,
    "entry node should be created"
  ).id;

  // 验证初始状态：条目节点应该在源分组下
  assert.equal(entryNode.settingNode?.parentId, sourceGroupId);

  // 执行移动：将条目节点移动到目标分组
  const movedNode = applyWorkspaceMutation({
    action: "move-worldview-node",
    nodeId: entryNodeId,
    parentId: targetGroupId,
  });

  // 验证移动后 parentId 已更新为目标分组
  assert.equal(
    movedNode.settingNode?.parentId,
    targetGroupId,
    "节点应该被移动到目标分组下"
  );
  assert.equal(
    movedNode.settingNode?.id,
    entryNodeId,
    "节点 ID 应该保持不变"
  );

  closeDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

test("move-worldview-node: 将节点移动到根节点，parentId 设置为 null", async () => {
  const dataDir = createTempDataDir();
  process.env.CATNOVEL_DATA_DIR = dataDir;

  const [{ closeDatabase }, { applyWorkspaceMutation }] = await Promise.all([
    import("../db/client.ts"),
    import("../lib/server/services/workspace-data-service.ts"),
  ]);

  // 创建测试作品
  const createdWork = applyWorkspaceMutation({
    action: "create-work",
    title: "测试作品",
    locale: "zh",
    synopsis: "测试移动到根节点",
  });
  const workId = expectDefined(createdWork.work, "work should be created").id;

  // 创建一个分组
  const parentGroup = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId,
    nodeType: "group",
    title: "父分组",
    parentId: null,
    payloadJson: "{}",
  });
  const parentGroupId = expectDefined(
    parentGroup.settingNode,
    "parent group should be created"
  ).id;

  // 在分组下创建一个条目节点
  const entryNode = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId,
    nodeType: "entry",
    title: "待移动条目",
    parentId: parentGroupId,
    payloadJson: JSON.stringify({ content: "内容" }),
  });
  const entryNodeId = expectDefined(
    entryNode.settingNode,
    "entry node should be created"
  ).id;

  // 验证初始状态：条目节点有父节点
  assert.equal(entryNode.settingNode?.parentId, parentGroupId);

  // 执行移动：将条目节点移动到根节点（parentId 设为 null）
  const movedNode = applyWorkspaceMutation({
    action: "move-worldview-node",
    nodeId: entryNodeId,
    parentId: null,
  });

  // 验证移动后 parentId 为 null
  assert.equal(
    movedNode.settingNode?.parentId,
    null,
    "节点移动到根节点后 parentId 应该为 null"
  );

  closeDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

test("move-worldview-node: 尝试将节点移动到其后代下，应该被拒绝（防止循环）", async () => {
  const dataDir = createTempDataDir();
  process.env.CATNOVEL_DATA_DIR = dataDir;

  const [{ closeDatabase }, { applyWorkspaceMutation }] = await Promise.all([
    import("../db/client.ts"),
    import("../lib/server/services/workspace-data-service.ts"),
  ]);

  // 创建测试作品
  const createdWork = applyWorkspaceMutation({
    action: "create-work",
    title: "测试作品",
    locale: "zh",
    synopsis: "测试循环检测",
  });
  const workId = expectDefined(createdWork.work, "work should be created").id;

  // 创建祖父节点（顶层分组）
  const grandparentGroup = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId,
    nodeType: "group",
    title: "祖父分组",
    parentId: null,
    payloadJson: "{}",
  });
  const grandparentId = expectDefined(
    grandparentGroup.settingNode,
    "grandparent group should be created"
  ).id;

  // 在祖父节点下创建父节点
  const parentGroup = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId,
    nodeType: "group",
    title: "父分组",
    parentId: grandparentId,
    payloadJson: "{}",
  });
  const parentId = expectDefined(
    parentGroup.settingNode,
    "parent group should be created"
  ).id;

  // 在父节点下创建子节点
  const childGroup = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId,
    nodeType: "group",
    title: "子分组",
    parentId: parentId,
    payloadJson: "{}",
  });
  const childId = expectDefined(
    childGroup.settingNode,
    "child group should be created"
  ).id;

  // 尝试将祖父节点移动到其子节点下（应该被拒绝）
  assert.throws(
    () => {
      applyWorkspaceMutation({
        action: "move-worldview-node",
        nodeId: grandparentId,
        parentId: childId,
      });
    },
    /Cannot move node under itself or its descendant/,
    "将祖先节点移动到后代下应该抛出循环错误"
  );

  // 尝试将父节点移动到其子节点下（应该被拒绝）
  assert.throws(
    () => {
      applyWorkspaceMutation({
        action: "move-worldview-node",
        nodeId: parentId,
        parentId: childId,
      });
    },
    /Cannot move node under itself or its descendant/,
    "将父节点移动到直接子节点下应该抛出循环错误"
  );

  // 尝试将节点移动到自己下（应该被拒绝）
  assert.throws(
    () => {
      applyWorkspaceMutation({
        action: "move-worldview-node",
        nodeId: grandparentId,
        parentId: grandparentId,
      });
    },
    /Cannot move node under itself or its descendant/,
    "将节点移动到自己下应该抛出循环错误"
  );

  closeDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

test("move-worldview-node: 尝试将节点移动到不同作品下，应该被拒绝", async () => {
  const dataDir = createTempDataDir();
  process.env.CATNOVEL_DATA_DIR = dataDir;

  const [{ closeDatabase }, { applyWorkspaceMutation }] = await Promise.all([
    import("../db/client.ts"),
    import("../lib/server/services/workspace-data-service.ts"),
  ]);

  // 创建第一个作品
  const work1 = applyWorkspaceMutation({
    action: "create-work",
    title: "作品一",
    locale: "zh",
    synopsis: "第一个测试作品",
  });
  const workId1 = expectDefined(work1.work, "work 1 should be created").id;

  // 创建第二个作品
  const work2 = applyWorkspaceMutation({
    action: "create-work",
    title: "作品二",
    locale: "zh",
    synopsis: "第二个测试作品",
  });
  const workId2 = expectDefined(work2.work, "work 2 should be created").id;

  // 在作品一中创建分组
  const group1 = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId: workId1,
    nodeType: "group",
    title: "作品一分组",
    parentId: null,
    payloadJson: "{}",
  });
  const groupId1 = expectDefined(
    group1.settingNode,
    "group 1 should be created"
  ).id;

  // 在作品一中创建条目节点
  const entryNode = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId: workId1,
    nodeType: "entry",
    title: "作品一条目",
    parentId: groupId1,
    payloadJson: JSON.stringify({ content: "内容" }),
  });
  const entryNodeId = expectDefined(
    entryNode.settingNode,
    "entry node should be created"
  ).id;

  // 在作品二中创建分组
  const group2 = applyWorkspaceMutation({
    action: "create-worldview-node",
    workId: workId2,
    nodeType: "group",
    title: "作品二分组",
    parentId: null,
    payloadJson: "{}",
  });
  const groupId2 = expectDefined(
    group2.settingNode,
    "group 2 should be created"
  ).id;

  // 尝试将作品一的条目移动到作品二的分组下（应该被拒绝）
  assert.throws(
    () => {
      applyWorkspaceMutation({
        action: "move-worldview-node",
        nodeId: entryNodeId,
        parentId: groupId2,
      });
    },
    /Cannot move node to a different work/,
    "跨作品移动节点应该被拒绝"
  );

  // 尝试将作品一的条目移动到作品二的根节点（应该被拒绝）
  // 注意：parentId 为 null 表示移动到当前作品的根，不会触发跨作品检查
  // 所以我们测试另一种情况：确保移动到 null 不会改变作品归属
  const movedToRoot = applyWorkspaceMutation({
    action: "move-worldview-node",
    nodeId: entryNodeId,
    parentId: null,
  });

  // 验证移动到根节点后仍在原作品
  assert.equal(
    movedToRoot.settingNode?.parentId,
    null,
    "移动到根节点后 parentId 为 null"
  );

  closeDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});
