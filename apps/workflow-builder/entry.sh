#!/bin/bash
# Workflow Builder entry point — delegates to the Next.js API via curl
set -e
BASE_URL="${WFB_BASE_URL:-http://localhost:3000}"
CMD="${1:-help}"
shift || true

case "$CMD" in
  list)
    curl -sS "$BASE_URL/api/workflow-builder/flows" | jq .
    ;;
  show)
    FLOW_ID="$1"
    curl -sS "$BASE_URL/api/workflow-builder/flows/$FLOW_ID" | jq .
    ;;
  run)
    FLOW_ID="$1"
    INPUT="${2:-{}}"
    curl -sS -X POST "$BASE_URL/api/workflow-builder/flows/$FLOW_ID/run" \
      -H 'content-type: application/json' \
      -d "{\"input\":$INPUT}" | jq .
    ;;
  templates)
    curl -sS "$BASE_URL/api/workflow-builder/templates" | jq .
    ;;
  help|*)
    echo "Workflow Builder CLI"
    echo "Usage:"
    echo "  agentic-wfb list                          Lista flows"
    echo "  agentic-wfb show <flow-id>                Mostra un flow"
    echo "  agentic-wfb run <flow-id> '<input-json>'  Esegui un flow"
    echo "  agentic-wfb templates                     Lista templates"
    ;;
esac
