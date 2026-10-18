#!/bin/sh
# Download the Human Reference Atlas 3D reference organs (Visible Human Female, HuBMAP, CC BY 4.0)
# used by the female body. Usage: sh tools/fetch-hra.sh data/hra
set -e
OUT=${1:-data/hra}
mkdir -p "$OUT"
curl -sSL https://apps.humanatlas.io/api/v1/reference-organs -o "$OUT/reference-organs.json"
node -e '
const a = require(require("path").resolve(process.argv[1]));
const want = /3d-vh-f-(skin|knee-[lr]|pelvis|intervertebral-disk|sternum|manubrium|mammary-gland-[lr]|ovary-[lr]|fallopian-tube-[lr]|uterus|urinary-bladder|lung|main-bronchus|trachea|liver|blood-vasculature)\.glb$/;
console.log(a.map((o) => o.object?.file).filter((f) => f && want.test(f)).join("\n"));
' "$OUT/reference-organs.json" | (cd "$OUT" && xargs -P 8 -n 1 curl -sSLO)
ls "$OUT"
