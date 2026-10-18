#!/bin/sh
# Download the BodyParts3D source data (CC BY 4.0, © The Database Center for Life Science) into $1.
# The server is slow, so the 136 MB mesh archive is fetched in 24 parallel byte ranges.
set -e
OUT=${1:?usage: tools/fetch-bodyparts3d.sh <dir>}
B=https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST
mkdir -p "$OUT/parts"
for f in isa_element_parts.txt partof_element_parts.txt partof_parts_list_e.txt; do curl -sfL -o "$OUT/$f" "$B/$f"; done
U=$B/isa_BP3D_4.0_obj_99.zip
T=$(curl -sI "$U" | awk 'tolower($1)=="content-length:"{print $2+0}')
N=24; C=$(( (T + N - 1) / N ))
for i in $(seq 0 $((N - 1))); do
  a=$((i * C)); b=$((a + C - 1)); [ $b -ge $T ] && b=$((T - 1))
  curl -sf --retry 5 -r $a-$b -o "$OUT/parts/$(printf %02d $i)" "$U" &
done
wait
cat "$OUT"/parts/* > "$OUT/isa.zip" && rm -r "$OUT/parts"
unzip -q -o "$OUT/isa.zip" -d "$OUT/obj"
echo "BodyParts3D ready in $OUT"
