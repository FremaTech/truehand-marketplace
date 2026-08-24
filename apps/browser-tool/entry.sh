#!/usr/bin/env bash
# Wrapper for browser-tool app
# Usage: invoked via /api/apps/browser-tool/run
# First arg = action (default: status)

ACTION="${1:-status}"
case "$ACTION" in
  status)
    curl -s http://127.0.0.1:3000/api/browser/sessions
    ;;
  profiles)
    curl -s http://127.0.0.1:3000/api/browser/profiles
    ;;
  *)
    echo "browser-tool: pass action like 'status' or 'profiles' or use /api/browser endpoints directly"
    ;;
esac
