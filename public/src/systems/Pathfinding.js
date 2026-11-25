// Busca em largura (BFS) na grade: distâncias e caminhos a partir de um tile.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function bfs(grid, sx, sy) {
  const n = grid.cols * grid.rows;
  const dist = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const start = grid.idx(sx, sy);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % grid.cols;
    const cy = (cur - cx) / grid.cols;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!grid.isWalkable(nx, ny)) continue;
      const ni = grid.idx(nx, ny);
      if (dist[ni] !== -1) continue;
      dist[ni] = dist[cur] + 1;
      prev[ni] = cur;
      queue[tail++] = ni;
    }
  }
  return { dist, prev, start };
}

// Caminho (lista de índices de tile, sem o inicial) até "target".
export function buildPath(prev, start, target) {
  const path = [];
  let c = target;
  while (c !== start && c !== -1) {
    path.push(c);
    c = prev[c];
  }
  return path.reverse();
}
