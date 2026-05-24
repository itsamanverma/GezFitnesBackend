#!/bin/bash

BASE_URL="https://xbpil-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link"
ORIGIN="https://xbpil-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link"
COOKIE_JAR="auth_cookies.txt"

echo "=== 1. TEST SIGNUP ==="
curl -X POST "$BASE_URL/api/auth/v1/signup" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{"name": "V1 Test User 2", "email": "v1.test2@example.com", "password": "password123"}' \
  -c $COOKIE_JAR -s | jq

echo -e "\n=== 2. TEST LOGIN ==="
curl -X POST "$BASE_URL/api/auth/v1/login" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{"email": "v1.test2@example.com", "password": "password123"}' \
  -c $COOKIE_JAR -s | jq

echo -e "\n=== 3. TEST ME (GET SESSION) ==="
curl -X GET "$BASE_URL/api/auth/v1/me" \
  -H "Origin: $ORIGIN" \
  -b $COOKIE_JAR -s | jq

echo -e "\n=== 4. TEST REFRESH ==="
curl -X POST "$BASE_URL/api/auth/v1/refresh" \
  -H "Origin: $ORIGIN" \
  -b $COOKIE_JAR -s | jq

echo -e "\n=== 5. TEST LOGOUT ==="
curl -X POST "$BASE_URL/api/auth/v1/logout" \
  -H "Origin: $ORIGIN" \
  -b $COOKIE_JAR -c $COOKIE_JAR -s | jq

