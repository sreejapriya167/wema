import { useState } from "react";
import api from "../api/client.js";
import { Panel } from "./ui/Panel.jsx";
import { formatCurrency } from "../pages/rider/RiderTabShared.jsx";

export default function PaymentModal({ policyId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentId, setPaymentId] = useState("");
  const [step, setStep] = useState("initiate"); // initiate, confirm, success
  const [error, setError] = useState("");

  const initiatePayment = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/payments/initiate", { policyId });
      setPaymentOrder(response.data.data);
      setStep("confirm");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to initiate payment");
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async () => {
    if (!paymentId.trim()) {
      setError("Please enter a payment ID");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/payments/verify", {
        orderId: paymentOrder.orderId,
        paymentId: paymentId.trim(),
        policyId: policyId,
        amount: paymentOrder.amount
      });

      setStep("success");
      onSuccess && onSuccess(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Payment verification failed");
    } finally {
      setLoading(false);
    }
  };

  const renderPremiumDetails = () => {
    if (!paymentOrder?.premiumDetails) return null;

    const details = paymentOrder.premiumDetails;

    return (
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-blue-300 mb-3">One-Time Premium Calculation</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Base Premium (Weekly):</span>
            <span className="text-white">{formatCurrency(details.basePremium)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Zone Risk ({details.zoneRiskScore}):</span>
            <span className="text-white">×{details.riskMultiplier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Season ({details.season}):</span>
            <span className="text-white">×{details.seasonMultiplier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Weekly Premium:</span>
            <span className="text-white">{formatCurrency(details.weeklyRate)}</span>
          </div>
          {details.cappedByIncome && (
            <div className="flex justify-between">
              <span className="text-gray-400">Income Cap (2%):</span>
              <span className="text-white">{formatCurrency(details.premiumCap)}</span>
            </div>
          )}
          <div className="border-t border-gray-600 pt-2 flex justify-between">
            <span className="text-gray-300">Lock-in Period:</span>
            <span className="text-white font-semibold">{details.lockInMonths} months (~{Math.round(details.lockInWeeks)} weeks)</span>
          </div>
          <div className="border-t border-gray-600 pt-2 flex justify-between font-semibold">
            <span className="text-white">Total for Lock-in:</span>
            <span className="text-green-400">{formatCurrency(details.totalPremiumForLockIn)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">
              {step === "initiate" && "One-Time Premium Payment"}
              {step === "confirm" && "Confirm Payment"}
              {step === "success" && "Payment Successful!"}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {step === "initiate" && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Click "Calculate Premium" to see your one-time premium for the entire lock-in period based on your earnings and risk factors.
              </p>

              <button
                onClick={initiatePayment}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
              >
                {loading ? "Calculating..." : "Calculate Premium"}
              </button>
            </div>
          )}

          {step === "confirm" && paymentOrder && (
            <div className="space-y-4">
              {renderPremiumDetails()}

              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-400">Amount to Pay:</span>
                  <span className="text-white font-semibold text-lg">
                    {formatCurrency(paymentOrder.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Order ID:</span>
                  <span className="text-gray-300 font-mono">{paymentOrder.orderId}</span>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-300 text-sm">
                  <strong>Mock Payment Mode:</strong> This is a demonstration payment. Enter any payment ID to complete the transaction.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment ID (Mock)
                </label>
                <input
                  type="text"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  placeholder="Enter any payment ID (e.g., mock_pay_123)"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={confirmPayment}
                disabled={loading || !paymentId.trim()}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
              >
                {loading ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          )}

          {step === "success" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto">
                <span className="text-white text-2xl">✓</span>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Payment Successful!</h4>
                <p className="text-gray-300 text-sm">
                  Your one-time premium payment has been processed. Your policy is now fully paid for the entire lock-in period.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}