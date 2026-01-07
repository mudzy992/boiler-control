#!/bin/sh
export NODE_OPTIONS="--dns-result-order=ipv4first"

echo "📌 Waiting for database..."
sleep 10

echo "🚀 Starting NestJS..."
node dist/main.js
