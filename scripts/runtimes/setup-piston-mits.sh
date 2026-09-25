#!/usr/bin/env bash
# ==============================================================================
# AlgoFight MITS Server: Piston Language Runtime Populator
# Run this script via Termius after starting algofight-piston-1.
# ==============================================================================

set -e

CONTAINER_NAME="algofight-piston-1"

echo "Checking if ${CONTAINER_NAME} is running..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Container ${CONTAINER_NAME} is not running."
    echo "Start it first using: docker compose up -d piston-1"
    exit 1
fi

echo "Installing language packages into shared volume via ${CONTAINER_NAME}..."

docker exec -i "${CONTAINER_NAME}" sh -c '
    echo "Installing Python 3.10.0..."
    piston-cli install python 3.10.0 || true

    echo "Installing GCC 10.2.0 (C/C++)..."
    piston-cli install gcc 10.2.0 || true

    echo "Installing Java 15.0.2..."
    piston-cli install java 15.0.2 || true

    echo "Installing Node.js 18.15.0..."
    piston-cli install node 18.15.0 || true

    echo "Installing TypeScript 5.0.3..."
    piston-cli install typescript 5.0.3 || true
'

echo "================================================="
echo "Verifying installed runtimes on Piston-1 (port 2001):"
curl -s http://127.0.0.1:2001/api/v2/runtimes | grep -o '"language":"[^"]*"' | sort -u || true

echo "================================================="
echo "Verifying installed runtimes on Piston-2 (port 2002):"
curl -s http://127.0.0.1:2002/api/v2/runtimes | grep -o '"language":"[^"]*"' | sort -u || true

echo "Piston setup complete! Shared runtime volume is prewarmed."
