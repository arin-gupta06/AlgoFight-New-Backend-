#!/usr/bin/env bash
# ==============================================================================
# AlgoFight MITS Server: Piston Language Runtime Populator & Validator
# Run this script via Termius after starting Piston containers.
# Addresses AF-06, AF-07, and AF-15 smoke validation.
# ==============================================================================

set -e

PRIMARY_CONTAINER="algofight-piston-1"
BACKUP_CONTAINER="algofight-piston-2"

echo "=== [1/4] Verifying Piston Containers State ==="
for CONTAINER in "${PRIMARY_CONTAINER}" "${BACKUP_CONTAINER}"; do
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
        echo "Error: Container ${CONTAINER} is not running."
        echo "Start containers first using: docker compose up -d piston-1 piston-2"
        exit 1
    fi
    echo "✔ Container ${CONTAINER} is running."
done

echo ""
echo "=== [2/4] Installing Required Runtimes into Shared Volume ==="
# No '|| true' mask: any actual installation failure will abort the script
docker exec -i "${PRIMARY_CONTAINER}" sh -c '
    set -e
    echo "Installing Python 3.10.0..."
    piston-cli install python 3.10.0

    echo "Installing GCC 10.2.0 (C/C++)..."
    piston-cli install gcc 10.2.0

    echo "Installing Java 15.0.2..."
    piston-cli install java 15.0.2

    echo "Installing Node.js 18.15.0..."
    piston-cli install node 18.15.0

    echo "Installing TypeScript 5.0.3..."
    piston-cli install typescript 5.0.3
'

echo ""
echo "=== [3/4] Auditing Runtime Inventory on Both Nodes ==="
check_runtimes() {
    local PORT=$1
    local NODE_NAME=$2
    local RUNTIMES_JSON
    RUNTIMES_JSON=$(curl -s "http://127.0.0.1:${PORT}/api/v2/runtimes" || echo "")

    if [ -z "${RUNTIMES_JSON}" ]; then
        echo "Error: Unable to query ${NODE_NAME} at http://127.0.0.1:${PORT}"
        return 1
    fi

    echo "Verifying languages on ${NODE_NAME}:"
    for LANG in "python" "c++" "java" "javascript" "typescript"; do
        if echo "${RUNTIMES_JSON}" | grep -q "\"language\":\"${LANG}\""; then
            echo "  ✔ ${LANG} is present"
        else
            echo "  ✖ ERROR: Required language '${LANG}' is missing on ${NODE_NAME}!"
            return 1
        fi
    done
}

check_runtimes 2001 "Piston-1 (Primary)"
check_runtimes 2002 "Piston-2 (Backup)"

echo ""
echo "=== [4/4] Executing Live Smoke Tests on Both Nodes ==="
smoke_test() {
    local PORT=$1
    local NODE_NAME=$2

    echo "Running Python smoke test on ${NODE_NAME} (port ${PORT})..."
    local PY_RES
    PY_RES=$(curl -s -X POST "http://127.0.0.1:${PORT}/api/v2/execute" \
        -H "Content-Type: application/json" \
        -d '{"language":"python","version":"*","files":[{"content":"print(\"ALGOFIGHT_PY_SUCCESS\")"}]}')

    if ! echo "${PY_RES}" | grep -q "ALGOFIGHT_PY_SUCCESS"; then
        echo "✖ Python execution smoke test failed on ${NODE_NAME}!"
        echo "Output: ${PY_RES}"
        return 1
    fi
    echo "  ✔ Python execution passed on ${NODE_NAME}"

    echo "Running C++ smoke test on ${NODE_NAME} (port ${PORT})..."
    local CPP_RES
    CPP_RES=$(curl -s -X POST "http://127.0.0.1:${PORT}/api/v2/execute" \
        -H "Content-Type: application/json" \
        -d '{"language":"c++","version":"*","files":[{"content":"#include<iostream>\nint main(){std::cout<<\"ALGOFIGHT_CPP_SUCCESS\";return 0;}"}]}')

    if ! echo "${CPP_RES}" | grep -q "ALGOFIGHT_CPP_SUCCESS"; then
        echo "✖ C++ execution smoke test failed on ${NODE_NAME}!"
        echo "Output: ${CPP_RES}"
        return 1
    fi
    echo "  ✔ C++ compilation and execution passed on ${NODE_NAME}"
}

smoke_test 2001 "Piston-1 (Primary)"
smoke_test 2002 "Piston-2 (Backup)"

echo ""
echo "================================================================="
echo "🎉 SUCCESS: Both Piston-1 and Piston-2 are verified and ready!"
echo "================================================================="
