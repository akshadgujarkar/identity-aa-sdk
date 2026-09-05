/**
 * @identity-aa-sdk/demo - GuestbookForm Component
 * Submits sponsored on-chain guestbook entries via useTransaction().
 * Specifications defined in docs/DEMO_APPLICATION.md and docs/USER_EXPERIENCE.md.
 */

import React, { useState } from "react";
import { useTransaction, useSmartAccount } from "@identity-aa-sdk/react";
import type { DemoUser, GuestbookEntry } from "../types.js";

export interface GuestbookFormProps {
  readonly user: DemoUser;
  readonly onEntrySubmitted: (entry: GuestbookEntry) => void;
}

export function GuestbookForm({ user, onEntrySubmitted }: GuestbookFormProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  const { address } = useSmartAccount();
  const { send, status, isLoading, isSuccess, isError, transactionHash, error, reset } = useTransaction();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !address || isLoading) return;

    try {
      // Encode string calldata for demo on-chain message execution
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message.trim());
      const hexData = "0x" + Array.from(messageBytes, (b) => b.toString(16).padStart(2, "0")).join("");

      // Single action triggers sponsored smart transaction
      const receipt = await send({
        to: "0x0000000000000000000000000000000000000001", // Demo guestbook recipient
        value: 0n,
        data: hexData as `0x${string}`,
      });

      const newEntry: GuestbookEntry = {
        id: `entry_${Date.now()}`,
        authorAddress: address,
        authorName: user.name,
        authorEmail: user.email,
        message: message.trim(),
        timestamp: Date.now(),
        txHash: receipt.transactionHash,
        isSponsored: true,
      };

      onEntrySubmitted(newEntry);
      setMessage("");
    } catch {
      // Error is tracked in useTransaction hook state
    }
  };

  return (
    <div className="guestbook-form-card" data-testid="guestbook-form" style={{
      padding: "20px",
      borderRadius: "12px",
      backgroundColor: "#1e1e24",
      border: "1px solid #2d2d38",
      marginBottom: "24px",
    }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#ffffff" }}>
        Sign the Web3 Guestbook
      </h3>
      <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#9ca3af" }}>
        Leave a message on-chain. Gas fees are 100% sponsored by the app paymaster.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "16px" }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say hello from your smart account..."
            disabled={isLoading}
            rows={3}
            data-testid="guestbook-message-input"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "#121217",
              border: "1px solid #374151",
              color: "#ffffff",
              fontSize: "14px",
              resize: "vertical",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="submit"
            disabled={!message.trim() || isLoading}
            data-testid="guestbook-submit-button"
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              backgroundColor: isLoading ? "#4f46e5" : "#6366f1",
              color: "#ffffff",
              border: "none",
              fontWeight: 600,
              fontSize: "14px",
              cursor: isLoading || !message.trim() ? "not-allowed" : "pointer",
              opacity: !message.trim() && !isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "Submitting to Blockchain..." : "Sign Guestbook"}
          </button>

          {isSuccess && (
            <div
              data-testid="confirmation-status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#10b981",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              <span>Confirmed ✓</span>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  background: "none",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                (dismiss)
              </button>
            </div>
          )}
        </div>
      </form>

      {isError && error && (
        <div
          data-testid="transaction-error"
          style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "8px",
            backgroundColor: "#450a0a",
            color: "#f87171",
            fontSize: "13px",
          }}
        >
          Failed to post entry: {error.message}
        </div>
      )}

      {transactionHash && (
        <div style={{ marginTop: "12px", fontSize: "12px", color: "#6b7280" }}>
          Transaction Hash: <code style={{ color: "#9ca3af" }}>{transactionHash}</code>
        </div>
      )}
    </div>
  );
}
