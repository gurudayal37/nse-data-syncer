#!/bin/bash
# Cancel all queued/in_progress keyword_analysis_single.yml runs.
# Usage: GH_PAT=ghp_xxx bash scripts/cancel_queued_runs.sh

OWNER="gurudayal37"
REPO="nse-data-syncer"
WORKFLOW="keyword_analysis_single.yml"
TOKEN="${GH_PAT}"

if [ -z "$TOKEN" ]; then
  echo "Set GH_PAT=<your token> before running"
  exit 1
fi

PAGE=1
CANCELLED=0

while true; do
  RUNS=$(curl -s \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$REPO/actions/workflows/$WORKFLOW/runs?status=queued&per_page=100&page=$PAGE")

  IDS=$(echo "$RUNS" | python3 -c "import sys,json; runs=json.load(sys.stdin).get('workflow_runs',[]); [print(r['id']) for r in runs]")

  if [ -z "$IDS" ]; then
    break
  fi

  for ID in $IDS; do
    curl -s -X POST \
      -H "Authorization: token $TOKEN" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/$OWNER/$REPO/actions/runs/$ID/cancel" > /dev/null
    echo "Cancelled run $ID"
    CANCELLED=$((CANCELLED + 1))
  done

  PAGE=$((PAGE + 1))
done

echo "Done. Cancelled $CANCELLED queued runs."
