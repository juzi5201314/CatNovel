declare module 'd3-hierarchy' {
  export function hierarchy<T>(
    data: T,
    children?: (d: T) => T[] | undefined
  ): any;

  export function tree<T>(): any;
}
