#!/bin/sh
export NODE_OPTIONS="--dns-result-order=ipv4first"
UPLOAD_ROOT_PATH="${UPLOAD_ROOT_PATH:-/usr/src/app/uploads}"

echo "📌 Waiting for database..."
sleep 10

echo "📁 Ensuring upload directories..."
mkdir -p "${UPLOAD_ROOT_PATH}/gas-readings" "${UPLOAD_ROOT_PATH}/users"

echo "🚀 Starting NestJS..."
node dist/src/main.js
