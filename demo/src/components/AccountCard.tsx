/**
 * @identity-aa-sdk/demo - AccountCard Component
 * Displays user identity, smart account address, and gas sponsorship status.
 * Adheres strictly to docs/USER_EXPERIENCE.md.
 */

import React, { useState } from "react";
import { useSmartAccount } from "@identity-aa-sdk/react";
import type { DemoUser } from "../types.js";

export interface AccountCardProps {
  readonly user: DemoUser;
  readonly onSignOut: () => void;
}

export function AccountCard({ user, onSignOut }: AccountCardProps): React.JSX.Element {
  const { account, address, isDeployed, isLoading, error } = useSmartAccount();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (address) {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(address).catch(() => {});
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Resolving...";

  return (
    <div className="account-card" data-testid="account-card" style={{
      padding: "20px",
      borderRadius: "12px",
      backgroundColor: "#1e1e24",
      color: "#ffffff",
      border: "1px solid #2d2d38",
      marginBottom: "24px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            backgroundColor: "#6366f1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "18px",
          }}>
            {user.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "16px" }}>{user.name}</div>
            <div style={{ fontSize: "13px", color: "#9ca3af" }}>{user.email}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          data-testid="sign-out-button"
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            backgroundColor: "transparent",
            color: "#9ca3af",
            border: "1px solid #374151",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Sign Out
        </button>
      </div>

      <div style={{
        padding: "12px 16px",
        borderRadius: "8px",
        backgroundColor: "#121217",
        border: "1px solid #272732",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>
            Smart Account Address
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "14px", color: "#f3f4f6" }} data-testid="smart-account-address">
            {address || (isLoading ? "Computing deterministic address..." : "Not available")}
          </div>
        </div>
        {address && (
          <button
            type="button"
            onClick={handleCopy}
            data-testid="copy-address-button"
            style={{
              padding: "4px 10px",
              borderRadius: "4px",
              backgroundColor: copied ? "#059669" : "#374151",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              transition: "background-color 0.2s",
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "12px" }}>
        <span
          data-testid="deployment-badge"
          style={{
            padding: "4px 10px",
            borderRadius: "20px",
            backgroundColor: isDeployed ? "#064e3b" : "#1e3a8a",
            color: isDeployed ? "#34d399" : "#93c5fd",
            fontWeight: 500,
          }}
        >
          {isDeployed ? "● Deployed on-chain" : "● Ready (Counterfactual)"}
        </span>
        <span
          data-testid="sponsorship-badge"
          style={{
            padding: "4px 10px",
            borderRadius: "20px",
            backgroundColor: "#312e81",
            color: "#c7d2fe",
            fontWeight: 500,
          }}
        >
          ⚡ 100% Gas Sponsored
        </span>
      </div>

      {error && (
        <div style={{ color: "#ef4444", fontSize: "13px" }} data-testid="account-error">
          Error: {error.message}
        </div>
      )}
    </div>
  );
}
