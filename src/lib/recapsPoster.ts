// Column span of each poster tile so every grid row closes exactly: a wide tile spans 2 only where 2 columns are
// left (and never in a 2-column grid, where it would sit alone), the last fact tile takes what remains of its row,
// and the personality tile (`you`, last) takes a full row.
export function posterSpans(tiles: { id: string; wide?: boolean }[], cols: number): number[] {
  const you = tiles.at(-1)?.id === 'you', facts = tiles.length - (you ? 1 : 0), out: number[] = [];
  let pos = 0;
  for (let i = 0; i < facts; i++) {
    const sp = i === facts - 1 ? cols - pos : tiles[i].wide && cols > 2 && pos + 2 <= cols ? 2 : 1;
    out.push(sp);
    pos = (pos + sp) % cols;
  }
  return you ? [...out, cols] : out;
}
