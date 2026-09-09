/** Minimize road distance with multi-start nearest-neighbor and directed 2-opt.
 * This is a practical approximation for larger delivery rounds, not an exact TSP solver. */
export function distanceOptimizedOrder(distances: number[][], roundTrip = true): number[] {
  const size = distances.length;
  if (size < 2 || distances.some(row => row.length !== size || row.some(d => !Number.isFinite(d) || d < 0))) throw new Error("Invalid distance matrix");
  const cost = (path: number[]) => path.slice(1).reduce((sum, next, i) => sum + distances[path[i]][next], 0) + (roundTrip ? distances[path[path.length - 1]][0] : 0);
  let best: number[] = [], bestCost = Infinity;
  for (let first = 1; first < size; first++) {
    let path = [0, first];
    const remaining = new Set(Array.from({length: size - 1}, (_, i) => i + 1).filter(i => i !== first));
    while (remaining.size) {
      const last = path[path.length - 1];
      const next = [...remaining].sort((a,b) => distances[last][a] - distances[last][b])[0];
      path.push(next); remaining.delete(next);
    }
    let currentCost = cost(path);
    for (let iteration = 0; iteration < 50; iteration++) {
      let improved = false;
      for (let a = 1; a < size - 1; a++) for (let b = a + 1; b < size; b++) {
        const candidate = [...path.slice(0,a), ...path.slice(a,b+1).reverse(), ...path.slice(b+1)];
        const candidateCost = cost(candidate);
        if (candidateCost < currentCost - 0.01) { path = candidate; currentCost = candidateCost; improved = true; }
      }
      if (!improved) break;
    }
    if (currentCost < bestCost) { best = path; bestCost = currentCost; }
  }
  return best.slice(1);
}
