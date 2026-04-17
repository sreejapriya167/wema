#!/bin/bash
# WEMA Payment Integration Test Script
# Tests all payment endpoints and verifies payment flows

set -e

BASE_URL="http://localhost:3000"
RIDER_TOKEN="${1:-}"
ADMIN_TOKEN="${2:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
  echo -e "${RED}[✗]${NC} $1"
}

# Check if tokens are provided
if [ -z "$RIDER_TOKEN" ] || [ -z "$ADMIN_TOKEN" ]; then
  log_error "Usage: ./test-payments.sh <RIDER_TOKEN> <ADMIN_TOKEN>"
  log_info "Example: ./test-payments.sh 'rider_jwt_token' 'admin_jwt_token'"
  exit 1
fi

log_info "Starting payment integration tests..."
log_info "Base URL: $BASE_URL"

# Test 1: Get Payment Dashboard
log_info "\n=== Test 1: Get Payment Dashboard ==="
DASHBOARD=$(curl -s -X GET "$BASE_URL/api/v1/payments/dashboard" \
  -H "Authorization: Bearer $RIDER_TOKEN")

if echo "$DASHBOARD" | grep -q '"success":true'; then
  log_success "Dashboard retrieved"
  echo "$DASHBOARD" | jq '.' || true
else
  log_error "Dashboard retrieval failed"
  echo "$DASHBOARD" | jq '.' || true
fi

# Extract policyId for next test
POLICY_ID=$(echo "$DASHBOARD" | jq -r '.data.activePolicy._id' 2>/dev/null || echo "")
if [ -z "$POLICY_ID" ] || [ "$POLICY_ID" == "null" ]; then
  log_error "Could not extract active policy ID"
  exit 1
fi
log_success "Policy ID: $POLICY_ID"

# Test 2: Initiate Payment
log_info "\n=== Test 2: Initiate Payment ==="
INITIATE=$(curl -s -X POST "$BASE_URL/api/v1/payments/initiate" \
  -H "Authorization: Bearer $RIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"policyId\": \"$POLICY_ID\", \"amount\": 99}")

if echo "$INITIATE" | grep -q '"success":true'; then
  log_success "Payment initiated"
  echo "$INITIATE" | jq '.' || true
else
  log_error "Payment initiation failed"
  echo "$INITIATE" | jq '.' || true
fi

# Extract orderId for verification test
ORDER_ID=$(echo "$INITIATE" | jq -r '.data.orderId' 2>/dev/null || echo "")
if [ -z "$ORDER_ID" ] || [ "$ORDER_ID" == "null" ]; then
  log_error "Could not extract order ID"
  exit 1
fi
log_success "Order ID: $ORDER_ID"

# Test 3: Verify Payment (Mock - not real Razorpay)
log_info "\n=== Test 3: Verify Payment (Mock Mode) ==="
VERIFY=$(curl -s -X POST "$BASE_URL/api/v1/payments/verify" \
  -H "Authorization: Bearer $RIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"$ORDER_ID\",
    \"paymentId\": \"pay_test_1234567890\",
    \"signature\": \"test_signature_for_mock_mode\",
    \"policyId\": \"$POLICY_ID\",
    \"amount\": 99
  }")

if echo "$VERIFY" | grep -q '"success":true'; then
  log_success "Payment verified"
  echo "$VERIFY" | jq '.' || true
else
  log_error "Payment verification failed (this is normal if Razorpay not configured)"
  echo "$VERIFY" | jq '.' || true
fi

# Test 4: Get Payment Orders
log_info "\n=== Test 4: Get Payment Orders ==="
ORDERS=$(curl -s -X GET "$BASE_URL/api/v1/payments/orders" \
  -H "Authorization: Bearer $RIDER_TOKEN")

if echo "$ORDERS" | grep -q '"success":true'; then
  log_success "Payment orders retrieved"
  ORDER_COUNT=$(echo "$ORDERS" | jq '.data | length')
  log_info "Total orders: $ORDER_COUNT"
  echo "$ORDERS" | jq '.data[0:3]' || true  # Show first 3 orders
else
  log_error "Payment orders retrieval failed"
  echo "$ORDERS" | jq '.' || true
fi

# Test 5: Admin - Trigger Weekly Collection
log_info "\n=== Test 5: Admin - Trigger Weekly Premium Collection ==="
COLLECT=$(curl -s -X POST "$BASE_URL/api/v1/payments/admin/collect-weekly" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$COLLECT" | grep -q '"success":true'; then
  log_success "Weekly collection triggered"
  SUCCESS=$(echo "$COLLECT" | jq '.data.success' 2>/dev/null || echo "0")
  FAILED=$(echo "$COLLECT" | jq '.data.failed' 2>/dev/null || echo "0")
  log_info "Success: $SUCCESS | Failed: $FAILED"
  echo "$COLLECT" | jq '.' || true
else
  log_error "Weekly collection trigger failed"
  echo "$COLLECT" | jq '.' || true
fi

# Test 6: Admin - Trigger Claim Payouts
log_info "\n=== Test 6: Admin - Trigger Automatic Claim Payouts ==="
PAYOUTS=$(curl -s -X POST "$BASE_URL/api/v1/payments/admin/payout-claims" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$PAYOUTS" | grep -q '"success":true'; then
  log_success "Claim payout triggered"
  PAID=$(echo "$PAYOUTS" | jq '.data.paid' 2>/dev/null || echo "0")
  FAILED=$(echo "$PAYOUTS" | jq '.data.failed' 2>/dev/null || echo "0")
  log_info "Paid: $PAID | Failed: $FAILED"
  echo "$PAYOUTS" | jq '.' || true
else
  log_error "Claim payout trigger failed"
  echo "$PAYOUTS" | jq '.' || true
fi

# Final Dashboard Check
log_info "\n=== Final Check: Payment Dashboard ==="
FINAL_DASHBOARD=$(curl -s -X GET "$BASE_URL/api/v1/payments/dashboard" \
  -H "Authorization: Bearer $RIDER_TOKEN")

TOTAL_PAID=$(echo "$FINAL_DASHBOARD" | jq '.data.totalPaid' 2>/dev/null || echo "0")
TOTAL_RECEIVED=$(echo "$FINAL_DASHBOARD" | jq '.data.totalReceived' 2>/dev/null || echo "0")

log_success "Test Summary:"
log_info "Total Premium Paid: ₹$TOTAL_PAID"
log_info "Total Payouts Received: ₹$TOTAL_RECEIVED"

log_info "\n✅ All payment tests completed!"
