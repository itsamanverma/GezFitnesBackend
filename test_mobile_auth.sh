#!/bin/bash

BASE_URL="https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link/api/auth/v1"

echo "=== 1. TEST SIGNUP ==="
SIGNUP_RES=$(curl -X POST "$BASE_URL/signup" \
  -H "Content-Type: application/json" \
  -d '{"name": "Pinggy Mobile Tester", "email": "mobile_pinggy@nexfit.com", "password": "password123"}' \
  -s)
echo $SIGNUP_RES | jq

# Extract Tokens
ACCESS_TOKEN=$(echo $SIGNUP_RES | jq -r '.data.accessToken')
REFRESH_TOKEN=$(echo $SIGNUP_RES | jq -r '.data.refreshToken')

echo -e "\n=== 2. TEST LOGIN ==="
LOGIN_RES=$(curl -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "mobile_pinggy@nexfit.com", "password": "password123"}' \
  -s)
echo $LOGIN_RES | jq

ACCESS_TOKEN=$(echo $LOGIN_RES | jq -r '.data.accessToken')
REFRESH_TOKEN=$(echo $LOGIN_RES | jq -r '.data.refreshToken')

echo -e "\n=== 3. TEST ME (ACCESS TOKEN) ==="
curl -X GET "$BASE_URL/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -s | jq

echo -e "\n=== 4. TEST REFRESH (REFRESH TOKEN) ==="
REFRESH_RES=$(curl -X POST "$BASE_URL/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" -s)
echo $REFRESH_RES | jq

NEW_ACCESS_TOKEN=$(echo $REFRESH_RES | jq -r '.data.accessToken')

echo -e "\n=== 5. TEST ME (NEW ACCESS TOKEN) ==="
curl -X GET "$BASE_URL/me" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" -s | jq

echo -e "\n=== 6. TEST INVALID TOKEN SECURITY ==="
curl -X GET "$BASE_URL/me" \
  -H "Authorization: Bearer invalid_jwt_token_here" -s | jq

echo -e "\n=== 7. TEST LOGOUT ==="
curl -X POST "$BASE_URL/logout" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" -s | jq

echo -e "\n=== 8. TEST ME (AFTER LOGOUT) ==="
curl -X GET "$BASE_URL/me" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" -s | jq

