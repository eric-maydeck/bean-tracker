#!/usr/bin/env bash
# Release jobs only, after the release commit is pushed: bring it back to main so the next
# `git push origin main:release` stays a fast-forward. Fast-forwards when main hasn't moved,
# else a merge commit. Needs `origin` to push with a token and HUSKY=0 (no local test gate).
set -euo pipefail
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git fetch origin main
git checkout -B main origin/main
git merge --no-edit -m "chore: merge release into main [skip ci]" release
git push origin main
