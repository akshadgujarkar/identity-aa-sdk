/**
 * @identity-aa-sdk/demo - AuthScreen Component
 * Clerk-style Web2 authentication screen for the demo.
 * Adheres strictly to docs/USER_EXPERIENCE.md (no wallet prompts or seed phrases).
 */

import React, { useState } from "react";
import { DEMO_USERS } from "../config.js";
import type { DemoUser } from "../types.js";

export interface AuthScreenProps {
  readonly onSelectUser: (user: DemoUser) => void;
}

export function AuthScreen({ onSelectUser }: AuthScreenProps): React.JSX.Element {
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim() || !customName.trim()) return;

    const customUser: DemoUser = {
      id: `user_clerk_custom_${Date.now()}`,
      name: customName.trim(),
      email: customEmail.trim(),
    };
    onSelectUser(customUser);
  };

  return (
    <div className="auth-screen" data-testid="auth-screen" style={{
      maxWidth: "480px",
      margin: "40px auto",
      padding: "32px",
      borderRadius: "16px",
      backgroundColor: "#1e1e24",
      border: "1px solid #2d2d38",
      color: "#ffffff",
      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
    }}>
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{
          display: "inline-flex",
          padding: "10px 16px",
          borderRadius: "20px",
          backgroundColor: "#312e81",
          color: "#c7d2fe",
          fontSize: "13px",
          fontWeight: 600,
          marginBottom: "16px",
        }}>
          Identity-Driven Account Abstraction
        </div>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "24px" }}>
          Welcome to Web3 Guestbook
        </h2>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: "14px" }}>
          Sign in with your Clerk identity. No wallet extension or seed phrase required.
        </p>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px", fontWeight: 600 }}>
          Quick Sign-In (Demo Personas)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {DEMO_USERS.map((user) => (
            <button
              key={user.id}
              type="button"
              data-testid={`sign-in-${user.id}`}
              onClick={() => onSelectUser(user)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "#121217",
                border: "1px solid #374151",
                color: "#ffffff",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.2s, background-color 0.2s",
              }}
            >
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "#4f46e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "14px",
              }}>
                {user.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{user.name}</div>
                <div style={{ fontSize: "12px", color: "#9ca3af" }}>{user.email}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", textAlign: "center", margin: "24px 0" }}>
        <hr style={{ border: "none", borderTop: "1px solid #2d2d38" }} />
        <span style={{
          position: "absolute",
          top: "-10px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#1e1e24",
          padding: "0 12px",
          color: "#6b7280",
          fontSize: "12px",
        }}>
          or custom email
        </span>
      </div>

      <form onSubmit={handleCustomSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="text"
            placeholder="Full Name (e.g. Satoshi Nakamoto)"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            data-testid="custom-name-input"
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              backgroundColor: "#121217",
              border: "1px solid #374151",
              color: "#ffffff",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <input
            type="email"
            placeholder="Email address (e.g. user@clerk.dev)"
            value={customEmail}
            onChange={(e) => setCustomEmail(e.target.value)}
            data-testid="custom-email-input"
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              backgroundColor: "#121217",
              border: "1px solid #374151",
              color: "#ffffff",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!customEmail.trim() || !customName.trim()}
            data-testid="custom-sign-in-button"
            style={{
              padding: "10px",
              borderRadius: "8px",
              backgroundColor: "#6366f1",
              color: "#ffffff",
              border: "none",
              fontWeight: 600,
              fontSize: "14px",
              cursor: !customEmail.trim() || !customName.trim() ? "not-allowed" : "pointer",
              opacity: !customEmail.trim() || !customName.trim() ? 0.6 : 1,
            }}
          >
            Continue with Custom Identity
          </button>
        </div>
      </form>
    </div>
  );
}
