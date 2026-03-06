import { internalError, ok, fail, parseJsonBody } from "@/lib/http/api-response";
import { WorldbuildingRepository } from "@/repositories/worldbuilding-repository";

type RouteContext = {
  params: Promise<{ projectId: string; nodeId: string }>;
};

const worldbuildingRepository = new WorldbuildingRepository();

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId, nodeId } = await context.params;
    if (!projectId || !nodeId) {
      return fail("INVALID_PARAM", "projectId and nodeId are required", 400);
    }

    const node = worldbuildingRepository.findById(nodeId);
    if (!node || node.projectId !== projectId) {
      return fail("NOT_FOUND", "Node not found", 404);
    }

    const children = worldbuildingRepository.getChildren(nodeId);
    return ok({ node, children });
  } catch (error) {
    return internalError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, nodeId } = await context.params;
    if (!projectId || !nodeId) {
      return fail("INVALID_PARAM", "projectId and nodeId are required", 400);
    }

    const existing = worldbuildingRepository.findById(nodeId);
    if (!existing || existing.projectId !== projectId) {
      return fail("NOT_FOUND", "Node not found", 404);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const body = bodyResult.data as Record<string, unknown>;
    const updates: { name?: string; description?: string; parentId?: string | null; sortOrder?: number } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (name.length === 0) {
        return fail("INVALID_INPUT", "name must be non-empty", 400);
      }
      updates.name = name;
    }

    if (typeof body.description === "string") {
      updates.description = body.description;
    }

    if (body.parentId !== undefined) {
      if (body.parentId === null) {
        updates.parentId = null;
      } else if (typeof body.parentId === "string" && body.parentId.trim().length > 0) {
        const parent = worldbuildingRepository.findById(body.parentId.trim());
        if (!parent || parent.projectId !== projectId) {
          return fail("INVALID_INPUT", "parent node not found in this project", 400);
        }
        updates.parentId = body.parentId.trim();
      }
    }

    if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder)) {
      updates.sortOrder = body.sortOrder;
    }

    const updated = worldbuildingRepository.update(nodeId, updates);
    if (!updated) {
      return fail("NOT_FOUND", "Node not found after update", 404);
    }

    return ok(updated);
  } catch (error) {
    if (error instanceof Error && error.message.includes("cannot move")) {
      return fail("INVALID_INPUT", error.message, 400);
    }
    return internalError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, nodeId } = await context.params;
    if (!projectId || !nodeId) {
      return fail("INVALID_PARAM", "projectId and nodeId are required", 400);
    }

    const existing = worldbuildingRepository.findById(nodeId);
    if (!existing || existing.projectId !== projectId) {
      return fail("NOT_FOUND", "Node not found", 404);
    }

    const deleted = worldbuildingRepository.deleteById(nodeId);
    return ok({ deleted, nodeId });
  } catch (error) {
    return internalError(error);
  }
}
