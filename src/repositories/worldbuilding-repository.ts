import { and, asc, eq, isNull, inArray } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { worldbuildingNodes, type WorldbuildingNodeRow } from "@/db/schema";

import { BaseRepository } from "./base-repository";

export type WorldbuildingNodeRecord = {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateNodeInput = {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  description?: string;
  sortOrder?: number;
};

export type UpdateNodeInput = {
  name?: string;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
};

function toRecord(row: WorldbuildingNodeRow): WorldbuildingNodeRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    parentId: row.parentId,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class WorldbuildingRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  listByProject(projectId: string): WorldbuildingNodeRecord[] {
    const rows = this.db
      .select()
      .from(worldbuildingNodes)
      .where(eq(worldbuildingNodes.projectId, projectId))
      .orderBy(asc(worldbuildingNodes.sortOrder), asc(worldbuildingNodes.createdAt))
      .all();

    return rows.map(toRecord);
  }

  getRootNodes(projectId: string): WorldbuildingNodeRecord[] {
    const rows = this.db
      .select()
      .from(worldbuildingNodes)
      .where(
        and(
          eq(worldbuildingNodes.projectId, projectId),
          isNull(worldbuildingNodes.parentId),
        ),
      )
      .orderBy(asc(worldbuildingNodes.sortOrder), asc(worldbuildingNodes.createdAt))
      .all();

    return rows.map(toRecord);
  }

  getChildren(parentId: string): WorldbuildingNodeRecord[] {
    const rows = this.db
      .select()
      .from(worldbuildingNodes)
      .where(eq(worldbuildingNodes.parentId, parentId))
      .orderBy(asc(worldbuildingNodes.sortOrder), asc(worldbuildingNodes.createdAt))
      .all();

    return rows.map(toRecord);
  }

  findById(id: string): WorldbuildingNodeRecord | null {
    const row = this.db
      .select()
      .from(worldbuildingNodes)
      .where(eq(worldbuildingNodes.id, id))
      .get();

    return row ? toRecord(row) : null;
  }

  create(input: CreateNodeInput): WorldbuildingNodeRecord {
    const sortOrder = input.sortOrder ?? this.getNextSortOrder(input.projectId, input.parentId);

    this.db
      .insert(worldbuildingNodes)
      .values({
        id: input.id,
        projectId: input.projectId,
        parentId: input.parentId,
        name: input.name,
        description: input.description ?? "",
        sortOrder,
      })
      .run();

    const created = this.findById(input.id);
    if (!created) {
      throw new Error("failed to create worldbuilding node");
    }
    return created;
  }

  update(id: string, input: UpdateNodeInput): WorldbuildingNodeRecord | null {
    return this.transaction((tx) => {
      const repo = new WorldbuildingRepository(tx);
      const existing = repo.findById(id);
      if (!existing) {
        return null;
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (input.name !== undefined) {
        updates.name = input.name;
      }
      if (input.description !== undefined) {
        updates.description = input.description;
      }
      if (input.sortOrder !== undefined) {
        updates.sortOrder = input.sortOrder;
      }
      if (input.parentId !== undefined) {
        if (input.parentId === id) {
          throw new Error("a node cannot be its own parent");
        }
        if (input.parentId !== null) {
          const descendants = repo.getDescendantIds(id);
          if (descendants.has(input.parentId)) {
            throw new Error("cannot move a node under its own descendant");
          }
        }
        updates.parentId = input.parentId;
      }

      tx.update(worldbuildingNodes)
        .set(updates)
        .where(eq(worldbuildingNodes.id, id))
        .run();

      return repo.findById(id);
    });
  }

  deleteById(id: string): boolean {
    const result = this.db
      .delete(worldbuildingNodes)
      .where(eq(worldbuildingNodes.id, id))
      .run();

    return result.changes > 0;
  }

  reorderChildren(projectId: string, parentId: string | null, orderedIds: string[]): void {
    this.transaction((tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const nodeId = orderedIds[i]!;
        tx.update(worldbuildingNodes)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(
            and(
              eq(worldbuildingNodes.id, nodeId),
              eq(worldbuildingNodes.projectId, projectId),
            ),
          )
          .run();
      }
    });
  }

  searchByText(projectId: string, query: string, limit = 50): WorldbuildingNodeRecord[] {
    const all = this.listByProject(projectId);
    const lowerQuery = query.toLowerCase();

    return all
      .filter(
        (node) =>
          node.name.toLowerCase().includes(lowerQuery) ||
          node.description.toLowerCase().includes(lowerQuery),
      )
      .slice(0, limit);
  }

  getDescendantIds(nodeId: string): Set<string> {
    const result = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.pop()!;
      const children = this.db
        .select({ id: worldbuildingNodes.id })
        .from(worldbuildingNodes)
        .where(eq(worldbuildingNodes.parentId, currentId))
        .all();

      for (const child of children) {
        if (!result.has(child.id)) {
          result.add(child.id);
          queue.push(child.id);
        }
      }
    }

    return result;
  }

  bulkDelete(ids: string[]): number {
    if (ids.length === 0) return 0;
    const result = this.db
      .delete(worldbuildingNodes)
      .where(inArray(worldbuildingNodes.id, ids))
      .run();
    return result.changes;
  }

  private getNextSortOrder(projectId: string, parentId: string | null): number {
    const siblings = parentId
      ? this.getChildren(parentId)
      : this.getRootNodes(projectId);

    if (siblings.length === 0) return 0;
    return Math.max(...siblings.map((s) => s.sortOrder)) + 1;
  }
}
