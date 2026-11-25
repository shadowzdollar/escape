#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/Hiraeth010/neon-district.git"
TARGET_DIR="/home/ghost/Projects/FENDER BENDER/game_reference"

echo "=== Starting resilient clone for $REPO_URL ==="
git config --global --unset http.lowSpeedLimit 2>/dev/null || true
git config --global --unset http.lowSpeedTime 2>/dev/null || true

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

git init
git remote add origin "$REPO_URL"
git config http.postBuffer 1048576000
git config http.version HTTP/1.1
git config core.compression 0

fetch_with_retry() {
    local cmd="$*"
    local max_retries=30
    local retry=0
    until eval "$cmd"; do
        retry=$((retry+1))
        if [ "$retry" -ge "$max_retries" ]; then
            echo "Failed after $max_retries attempts: $cmd"
            return 1
        fi
        echo "Fetch attempt $retry failed. Sleeping 3s and retrying..."
        sleep 3
    done
}

echo "Step 1: Fetching initial commit (depth 1)..."
fetch_with_retry "git fetch --depth=1 origin main"

echo "Step 2: Checking out main branch..."
git checkout -b main origin/main

echo "Step 3: Progressively unshallowing history to download entire repo without leaving anything behind..."
while [ "$(git rev-parse --is-shallow-repository)" = "true" ]; do
    echo "Current commit count: $(git rev-list --count HEAD)"
    echo "Deepening repository by 100 commits..."
    if ! fetch_with_retry "git fetch --deepen=100 origin main"; then
        echo "Attempting direct unshallow..."
        fetch_with_retry "git fetch --unshallow origin main" || break
    fi
    # If fetch --deepen made no changes or we can unshallow directly:
    if ! fetch_with_retry "git fetch --unshallow origin main 2>/dev/null"; then
        echo "Continuing deepening..."
    else
        echo "Successfully unshallowed!"
        break
    fi
done

echo "Step 4: Ensuring all tags and refs are fetched..."
fetch_with_retry "git fetch --tags origin" || true

echo "Step 5: Updating submodules if any..."
fetch_with_retry "git submodule update --init --recursive" || true

if command -v git-lfs >/dev/null 2>&1; then
    echo "Step 6: Checking git lfs..."
    git lfs pull || true
fi

echo "=== Resilient clone completed! ==="
echo "Is shallow: $(git rev-parse --is-shallow-repository)"
echo "Total commits: $(git rev-list --count HEAD)"
git log -1 --oneline
ls -la
