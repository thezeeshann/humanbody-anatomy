// Types for the isosurface package (Mikola Lysenko), which ships none.
declare module "isosurface" {
  type Mesher = (
    dims: number[],
    potential: (x: number, y: number, z: number) => number,
    bounds?: number[][],
  ) => { positions: [number, number, number][]; cells: number[][] };
  export const marchingCubes: Mesher;
  export const marchingTetrahedra: Mesher;
  export const surfaceNets: Mesher;
}
