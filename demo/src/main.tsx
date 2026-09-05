import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom/client";
import {
  ClerkProvider,
  useClerk,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { ClerkIdentityResolver } from "@identity-aa-sdk/clerk";
import {
  IdentityAAProvider,
  useSmartAccount,
  useTransaction,
} from "@identity-aa-sdk/react";
import {
  DEFAULT_LOCAL_NETWORK,
  type SDKConfig,
  type AppIdentity,
} from "@identity-aa-sdk/core";
import { GuestbookApp } from "./GuestbookApp.js";
import { DEMO_USERS, createDemoSDKConfig } from "./config.js";
import type { GuestbookEntry } from "./types.js";

// SDK Network Config
const localConfig = createDemoSDKConfig();

// Real Clerk Session Wrapper Component
function RealClerkSessionRoot() {
  const clerk = useClerk();
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);

  const resolver = useMemo(() => {
    return new ClerkIdentityResolver(() => clerk.session);
  }, [clerk.session]);

  const clerkUser = clerk.user
    ? {
        id: clerk.user.id,
        name: clerk.user.fullName || clerk.user.username || "Authenticated User",
        email: clerk.user.primaryEmailAddress?.emailAddress || "user@clerk.dev",
      }
    : { id: "unknown", name: "User", email: "user@clerk.dev" };

  return (
    <IdentityAAProvider config={localConfig} resolver={resolver}>
      <LiveSDKTester user={clerkUser} entries={entries} onAddEntry={(e) => setEntries((prev) => [e, ...prev])} />
    </IdentityAAProvider>
  );
}

// Live SDK Tester Component (used by both Real Clerk and Persona Modes)
function LiveSDKTester({
  user,
  entries,
  onAddEntry,
}: {
  user: { id: string; name: string; email: string };
  entries: GuestbookEntry[];
  onAddEntry: (entry: GuestbookEntry) => void;
}) {
  const { address, isDeployed, isLoading: isResolvingAccount, error: accountError } = useSmartAccount();
  const { send, isLoading: isTxSending, isSuccess, transactionHash, error: txError, reset } = useTransaction();
  const [message, setMessage] = useState("");
  const [customTo, setCustomTo] = useState("0x0000000000000000000000000000000000000001");
  const [activeTab, setActiveTab] = useState<"guestbook" | "custom">("guestbook");

  const handleSendGuestbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !address || isTxSending) return;

    try {
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message.trim());
      const hexData = "0x" + Array.from(messageBytes, (b) => b.toString(16).padStart(2, "0")).join("");

      const receipt = await send({
        to: "0x0000000000000000000000000000000000000001",
        value: 0n,
        data: hexData as `0x${string}`,
      });

      onAddEntry({
        id: `entry_${Date.now()}`,
        authorAddress: address,
        authorName: user.name,
        authorEmail: user.email,
        message: message.trim(),
        timestamp: Date.now(),
        txHash: receipt.transactionHash,
        isSponsored: true,
      });

      setMessage("");
    } catch {
      // Handled by hook
    }
  };

  const handleSendCustomTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTo.startsWith("0x") || isTxSending) return;

    try {
      await send({
        to: customTo as `0x${string}`,
        value: 0n,
        data: "0x",
      });
    } catch {
      // Handled by hook
    }
  };

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto" }}>
      {/* Account Profile Card */}
      <div style={{
        padding: "24px",
        borderRadius: "16px",
        backgroundColor: "#16161f",
        border: "1px solid #282838",
        marginBottom: "24px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "18px",
            }}>
              {user.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "16px" }}>{user.name}</div>
              <div style={{ fontSize: "13px", color: "#9ca3af" }}>{user.email}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              padding: "4px 12px",
              borderRadius: "20px",
              backgroundColor: isDeployed ? "#064e3b" : "#1e3a8a",
              color: isDeployed ? "#34d399" : "#93c5fd",
              fontSize: "12px",
              fontWeight: 600,
            }}>
              {isDeployed ? "● Deployed on-chain" : "● Ready (Counterfactual)"}
            </span>
            <span style={{
              padding: "4px 12px",
              borderRadius: "20px",
              backgroundColor: "#312e81",
              color: "#c7d2fe",
              fontSize: "12px",
              fontWeight: 600,
            }}>
              ⚡ 100% Gas Sponsored
            </span>
          </div>
        </div>

        <div style={{
          padding: "14px 18px",
          borderRadius: "10px",
          backgroundColor: "#0d0d12",
          border: "1px solid #232332",
        }}>
          <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>
            Smart Account Address (Deterministic CREATE2)
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "15px", color: "#60a5fa", wordBreak: "break-all" }}>
            {address || (isResolvingAccount ? "Computing address from identity..." : "Address unavailable")}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("guestbook")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            backgroundColor: activeTab === "guestbook" ? "#6366f1" : "#1e1e28",
            color: "#ffffff",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Web3 Guestbook Action
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("custom")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            backgroundColor: activeTab === "custom" ? "#6366f1" : "#1e1e28",
            color: "#ffffff",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Custom Transaction
        </button>
      </div>

      {/* Action Form */}
      {activeTab === "guestbook" ? (
        <div style={{
          padding: "24px",
          borderRadius: "16px",
          backgroundColor: "#16161f",
          border: "1px solid #282838",
          marginBottom: "24px",
        }}>
          <h3 style={{ margin: "0 0 8px 0" }}>Sign Web3 Guestbook</h3>
          <p style={{ margin: "0 0 16px 0", color: "#9ca3af", fontSize: "13px" }}>
            Submit an on-chain message signed by your smart account. Zero native gas tokens needed.
          </p>
          <form onSubmit={handleSendGuestbook}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Leave a message on the blockchain..."
              rows={3}
              disabled={isTxSending}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                backgroundColor: "#0d0d12",
                border: "1px solid #374151",
                color: "#ffffff",
                fontSize: "14px",
                marginBottom: "16px",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="submit"
                disabled={!message.trim() || isTxSending}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  backgroundColor: isTxSending ? "#4f46e5" : "#6366f1",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  cursor: isTxSending || !message.trim() ? "not-allowed" : "pointer",
                }}
              >
                {isTxSending ? "Broadcasting to Bundler..." : "Sign Guestbook"}
              </button>

              {isSuccess && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#10b981", fontWeight: 600 }}>
                  <span>Confirmed ✓</span>
                  <button type="button" onClick={() => reset()} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "12px" }}>
                    (dismiss)
                  </button>
                </div>
              )}
            </div>
          </form>

          {transactionHash && (
            <div style={{ marginTop: "16px", padding: "10px", borderRadius: "6px", backgroundColor: "#0d0d12", fontSize: "12px" }}>
              Tx Hash: <code style={{ color: "#34d399" }}>{transactionHash}</code>
            </div>
          )}

          {txError && (
            <div style={{ marginTop: "16px", padding: "10px", borderRadius: "6px", backgroundColor: "#450a0a", color: "#f87171", fontSize: "13px" }}>
              Error: {txError.message}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: "24px",
          borderRadius: "16px",
          backgroundColor: "#16161f",
          border: "1px solid #282838",
          marginBottom: "24px",
        }}>
          <h3 style={{ margin: "0 0 8px 0" }}>Send Custom Smart Transaction</h3>
          <form onSubmit={handleSendCustomTx}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "#9ca3af", marginBottom: "6px" }}>
                Recipient Contract Address
              </label>
              <input
                type="text"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#0d0d12",
                  border: "1px solid #374151",
                  color: "#ffffff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isTxSending}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                backgroundColor: "#6366f1",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                cursor: isTxSending ? "not-allowed" : "pointer",
              }}
            >
              {isTxSending ? "Sending via Bundler..." : "Send Sponsored Call"}
            </button>
          </form>
        </div>
      )}

      {/* Guestbook Entries */}
      {entries.length > 0 && (
        <div style={{
          padding: "24px",
          borderRadius: "16px",
          backgroundColor: "#16161f",
          border: "1px solid #282838",
        }}>
          <h4 style={{ margin: "0 0 16px 0" }}>Live On-Chain Entries ({entries.length})</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {entries.map((entry) => (
              <div key={entry.id} style={{ padding: "14px", borderRadius: "8px", backgroundColor: "#0d0d12", border: "1px solid #222230" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                  <span style={{ fontWeight: 600 }}>{entry.authorName} <code style={{ color: "#9ca3af", fontSize: "11px" }}>({entry.authorAddress.slice(0, 6)}...{entry.authorAddress.slice(-4)})</code></span>
                  <span style={{ color: "#34d399", fontSize: "11px", backgroundColor: "#064e3b", padding: "2px 8px", borderRadius: "10px" }}>Gas Sponsored</span>
                </div>
                <div style={{ fontSize: "14px", color: "#e5e7eb" }}>{entry.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Top-Level App Container with Clerk & Persona Switcher
function RootApp() {
  const [mode, setMode] = useState<"persona" | "clerk">("persona");
  const [clerkKey, setClerkKey] = useState(
    (globalThis as any).process?.env?.VITE_CLERK_PUBLISHABLE_KEY || ""
  );
  const [activeKey, setActiveKey] = useState(clerkKey);

  return (
    <div style={{ minHeight: "100vh", padding: "32px 20px" }}>
      {/* Top Header */}
      <header style={{
        maxWidth: "760px",
        margin: "0 auto 32px auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            backgroundColor: "#6366f1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "18px",
          }}>
            ⚡
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
              Identity AA SDK Live Tester
            </h1>
            <div style={{ fontSize: "12px", color: "#9ca3af" }}>
              Chain: Anvil (31337) • ERC-4337 v0.7
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div style={{ display: "flex", backgroundColor: "#16161f", padding: "4px", borderRadius: "10px", border: "1px solid #282838" }}>
          <button
            type="button"
            onClick={() => setMode("persona")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              backgroundColor: mode === "persona" ? "#6366f1" : "transparent",
              color: "#ffffff",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Demo Personas
          </button>
          <button
            type="button"
            onClick={() => setMode("clerk")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              backgroundColor: mode === "clerk" ? "#6366f1" : "transparent",
              color: "#ffffff",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Real Clerk Auth
          </button>
        </div>
      </header>

      {/* Mode View */}
      {mode === "persona" ? (
        <GuestbookApp />
      ) : (
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          {!activeKey ? (
            <div style={{
              padding: "32px",
              borderRadius: "16px",
              backgroundColor: "#16161f",
              border: "1px solid #282838",
              textAlign: "center",
            }}>
              <h3 style={{ margin: "0 0 12px 0" }}>Connect Real Clerk Account</h3>
              <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "20px" }}>
                Enter your Clerk Publishable Key (<code>pk_test_...</code>) from your Clerk dashboard:
              </p>
              <form onSubmit={(e) => { e.preventDefault(); setActiveKey(clerkKey); }}>
                <input
                  type="text"
                  placeholder="pk_test_..."
                  value={clerkKey}
                  onChange={(e) => setClerkKey(e.target.value)}
                  style={{
                    width: "100%",
                    maxWidth: "400px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#0d0d12",
                    border: "1px solid #374151",
                    color: "#ffffff",
                    fontSize: "14px",
                    marginBottom: "16px",
                    outline: "none",
                  }}
                />
                <br />
                <button
                  type="submit"
                  disabled={!clerkKey.trim()}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "8px",
                    backgroundColor: "#6366f1",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 600,
                    cursor: !clerkKey.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  Start with Clerk
                </button>
              </form>
            </div>
          ) : (
            <ClerkProvider publishableKey={activeKey}>
              <SignedOut>
                <div style={{
                  padding: "40px",
                  borderRadius: "16px",
                  backgroundColor: "#16161f",
                  border: "1px solid #282838",
                  textAlign: "center",
                }}>
                  <h3 style={{ margin: "0 0 12px 0" }}>Sign In with Clerk</h3>
                  <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "24px" }}>
                    Sign in with Google, Email, or Passkey. Your smart account will be derived instantly.
                  </p>
                  <SignInButton mode="modal">
                    <button style={{
                      padding: "12px 28px",
                      borderRadius: "8px",
                      backgroundColor: "#6366f1",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: "15px",
                      cursor: "pointer",
                    }}>
                      Sign In with Clerk Modal
                    </button>
                  </SignInButton>
                </div>
              </SignedOut>
              <SignedIn>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                  <UserButton />
                </div>
                <RealClerkSessionRoot />
              </SignedIn>
            </ClerkProvider>
          )}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
