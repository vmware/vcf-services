#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_DIR="${SCRIPT_DIR}/../bundle"

echo "Running VCF Service unit tests..."

for test_file in "${SCRIPT_DIR}"/test-*.yml; do
    [ -f "$test_file" ] || continue
    echo "Running: $(basename "$test_file")"
    ytt -f "${BUNDLE_DIR}/config" \
        --data-values-file "${test_file}" \
        > /dev/null
    echo "PASSED"
done

echo "All tests passed!"
