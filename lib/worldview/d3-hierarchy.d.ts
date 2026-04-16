declare module 'd3-hierarchy' {
  export interface HierarchyNode<T> {
    data: T;
    children?: HierarchyNode<T>[];
    depth: number;
    height: number;
    parent: HierarchyNode<T> | null;
    each(callback: (node: this) => void): void;
  }

  export interface HierarchyPointNode<T> extends HierarchyNode<T> {
    x: number;
    y: number;
  }

  export interface TreeLayout<T> {
    nodeSize(size: [number, number]): TreeLayout<T>;
    (root: HierarchyNode<T>): HierarchyPointNode<T>;
  }

  export function hierarchy<T>(
    data: T,
    children?: (d: T) => T[] | undefined
  ): HierarchyNode<T>;

  export function tree<T>(): TreeLayout<T>;
}
