#!/bin/bash
set -a; source .env.local; set +a
source .venv-train/bin/activate
mkdir -p logs

INGESTERS=(bts-db1b bts-t100 kaggle huggingface quality-gate)
TOTAL_START=$(date +%s)

for name in "${INGESTERS[@]}"; do
  START=$(date +%s)
  echo ""
  echo "╔════════════════════════════════════════╗"
  echo "║ [$name] START at $(date +%H:%M:%S)"
  echo "╚════════════════════════════════════════╝"

  if npx tsx "scripts/ingest/${name}.ts" 2>&1 | tee "logs/ingest-${name}-$(date +%Y%m%d-%H%M).log"; then
    DUR=$(($(date +%s) - START))
    echo "✅ [$name] DONE in ${DUR}s"
  else
    DUR=$(($(date +%s) - START))
    echo "⚠️  [$name] FAILED after ${DUR}s, continuing..."
  fi
done

TOTAL_DUR=$(($(date +%s) - TOTAL_START))
echo ""
echo "╔════════════════════════════════════════╗"
echo "║ ALL INGESTERS DONE in ${TOTAL_DUR}s"
echo "╚════════════════════════════════════════╝"
