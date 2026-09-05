/**
 * @identity-aa-sdk/demo - GuestbookList Component
 * Displays signed guestbook entries.
 */

import React from "react";
import type { GuestbookEntry } from "../types.js";

export interface GuestbookListProps {
  readonly entries: readonly GuestbookEntry[];
}

export function GuestbookList({ entries }: GuestbookListProps): React.JSX.Element {
  if (entries.length === 0) {
    return (
      <div
        data-testid="guestbook-empty"
        style={{
          padding: "32px",
          textAlign: "center",
          backgroundColor: "#1e1e24",
          borderRadius: "12px",
          border: "1px dashed #374151",
          color: "#9ca3af",
          fontSize: "14px",
        }}
      >
        No entries yet. Be the first to sign the guestbook!
      </div>
    );
  }

  return (
    <div className="guestbook-list" data-testid="guestbook-list">
      <h3 style={{ fontSize: "16px", color: "#ffffff", marginBottom: "16px" }}>
        Recent Entries ({entries.length})
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {entries.map((entry) => (
          <div
            key={entry.id}
            data-testid={`guestbook-entry-${entry.id}`}
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: "#1e1e24",
              border: "1px solid #2d2d38",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: 600, color: "#ffffff", fontSize: "14px", marginRight: "8px" }}>
                  {entry.authorName}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#9ca3af" }}>
                  ({entry.authorAddress.slice(0, 6)}...{entry.authorAddress.slice(-4)})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {entry.isSponsored && (
                  <span style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    backgroundColor: "#312e81",
                    color: "#c7d2fe",
                  }}>
                    Sponsored
                  </span>
                )}
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
            <p style={{ margin: 0, color: "#e5e7eb", fontSize: "14px", whiteSpace: "pre-wrap" }}>
              {entry.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
