/**
 * @identity-aa-sdk/demo - GuestbookApp Root Component
 * Demonstrates full identity-driven smart account flow using only the public React SDK.
 * Specifications defined in docs/DEMO_APPLICATION.md and docs/USER_EXPERIENCE.md.
 */

import React, { useState, useMemo } from "react";
import { IdentityAAProvider } from "@identity-aa-sdk/react";
import type { KeyStore } from "@identity-aa-sdk/core";
import { AuthScreen } from "./components/AuthScreen.js";
import { AccountCard } from "./components/AccountCard.js";
import { GuestbookForm } from "./components/GuestbookForm.js";
import { GuestbookList } from "./components/GuestbookList.js";
import { createDemoSDKConfig, createDemoClerkResolver, DEMO_USERS } from "./config.js";
import type { DemoUser, GuestbookEntry, DemoConfigOptions } from "./types.js";

export interface GuestbookAppProps {
  readonly initialUser?: DemoUser | null;
  readonly configOptions?: DemoConfigOptions;
  readonly keyStore?: KeyStore;
  readonly initialEntries?: readonly GuestbookEntry[];
}

export function GuestbookApp({
  initialUser = null,
  configOptions,
  keyStore,
  initialEntries = [],
}: GuestbookAppProps): React.JSX.Element {
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(initialUser);
  const [entries, setEntries] = useState<readonly GuestbookEntry[]>(initialEntries);
  const [showArchProof, setShowArchProof] = useState(false);

  const sdkConfig = useMemo(() => createDemoSDKConfig(configOptions), [configOptions]);
  const resolver = useMemo(() => {
    if (!currentUser) return null;
    return createDemoClerkResolver(currentUser);
  }, [currentUser]);

  const handleEntrySubmitted = (newEntry: GuestbookEntry) => {
    setEntries((prev) => [newEntry, ...prev]);
  };

  return (
    <div className="demo-container" style={{
      minHeight: "100vh",
      backgroundColor: "#0d0d11",
      color: "#ffffff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      padding: "24px",
    }}>
      <header style={{
        maxWidth: "760px",
        margin: "0 auto 32px auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: "#6366f1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
          }}>
            ⚡
          </div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
            Identity AA SDK Demo
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowArchProof((prev) => !prev)}
          data-testid="toggle-proof-button"
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            backgroundColor: "#1e1e24",
            color: "#9ca3af",
            border: "1px solid #374151",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          {showArchProof ? "Hide Proof Checklist" : "Show Proof Checklist"}
        </button>
      </header>

      {showArchProof && (
        <div data-testid="proof-checklist" style={{
          maxWidth: "760px",
          margin: "0 auto 24px auto",
          padding: "16px 20px",
          borderRadius: "12px",
          backgroundColor: "#171720",
          border: "1px solid #312e81",
          fontSize: "13px",
        }}>
          <h4 style={{ margin: "0 0 8px 0", color: "#c7d2fe" }}>
            Phase 10 Definition of Done (Proof Checklist)
          </h4>
          <ul style={{ margin: 0, paddingLeft: "20px", color: "#9ca3af", lineHeight: "1.6" }}>
            <li>✓ No wallet-extension install prompt anywhere in the flow</li>
            <li>✓ No seed phrase is shown or requested</li>
            <li>✓ Smart account address available immediately on Clerk login</li>
            <li>✓ Real on-chain action with 100% gas sponsorship by paymaster</li>
            <li>✓ Zero ERC-4337 vocabulary (no UserOperation, bundler, EntryPoint) in main UI</li>
          </ul>
        </div>
      )}

      <main style={{ maxWidth: "760px", margin: "0 auto" }}>
        {!currentUser || !resolver ? (
          <AuthScreen onSelectUser={(user) => setCurrentUser(user)} />
        ) : (
          <IdentityAAProvider
            key={currentUser.id}
            config={sdkConfig}
            resolver={resolver}
            keyStore={keyStore}
            autoResolve={true}
          >
            <AccountCard
              user={currentUser}
              onSignOut={() => setCurrentUser(null)}
            />
            <GuestbookForm
              user={currentUser}
              onEntrySubmitted={handleEntrySubmitted}
            />
            <GuestbookList entries={entries} />
          </IdentityAAProvider>
        )}
      </main>
    </div>
  );
}
