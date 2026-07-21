import { useState } from "react";

const LOGO_URL = "https://i.imgur.com/placeholder.png"; // fallback

// PIN for dashboard access
const DASHBOARD_PIN = "1234"; // placeholder — replace with real PIN

function PinModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleKey = (digit) => {
    if (pin.length < 6) setPin((p) => p + digit);
  };

  const handleSubmit = () => {
    if (pin === DASHBOARD_PIN) {
      setError("");
      onSuccess();
    } else {
      setError("Incorrect PIN. Please try again.");
      setPin("");
    }
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "28px 24px",
        width: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", textAlign: "center"
      }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>🔢</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>Enter Dashboard PIN</div>
        <div style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
          Enter your group PIN to view the totals dashboard.
        </div>

        {/* PIN dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 18 }}>
          {[0,1,2,3,4,5].map(i => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: "50%",
              background: i < pin.length ? "#c0392b" : "#e0e0e0",
              border: "2px solid #ccc", transition: "background 0.2s"
            }} />
          ))}
        </div>

        {error && <div style={{ color: "#c0392b", fontSize: 12, marginBottom: 10 }}>{error}</div>}

        {/* Keypad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
            <button key={i} onClick={() => k === "⌫" ? handleDelete() : k ? handleKey(k) : null}
              style={{
                padding: "14px 0", fontSize: 20, fontWeight: 600,
                background: k === "" ? "transparent" : "#f5f5f5",
                border: "none", borderRadius: 10, cursor: k === "" ? "default" : "pointer",
                color: k === "⌫" ? "#c0392b" : "#222",
                visibility: k === "" ? "hidden" : "visible"
              }}>
              {k}
            </button>
          ))}
        </div>

        <button onClick={handleSubmit}
          style={{
            width: "100%", padding: "13px 0", background: "#c0392b",
            color: "#fff", border: "none", borderRadius: 10,
            fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8
          }}>
          Confirm
        </button>
        <button onClick={onClose}
          style={{
            width: "100%", padding: "10px 0", background: "transparent",
            color: "#888", border: "none", fontSize: 13, cursor: "pointer"
          }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function DashboardPanel({ onClose }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "16px",
      border: "2px solid #c0392b", marginBottom: 16, position: "relative"
    }}>
      <button onClick={onClose} style={{
        position: "absolute", top: 10, right: 10,
        background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#888"
      }}>✕</button>

      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
        {/* Left: progress + amount */}
        <div style={{
          flex: 1, background: "#fafafa", borderRadius: 10, padding: "12px 14px",
          display: "flex", alignItems: "center", gap: 12
        }}>
          {/* Circle progress */}
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "4px solid #e0e0e0", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#444"
          }}>0%</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#222" }}>KSh 0</div>
            <div style={{ fontSize: 12, color: "#888" }}>2026-06-28</div>
          </div>
        </div>

        {/* Right: paybill + account */}
        <div style={{
          background: "#fafafa", borderRadius: 10, padding: "12px 14px",
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 6
        }}>
          <div>
            <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Paybill</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#222" }}>544600</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Account</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#222" }}>942540</div>
          </div>
        </div>
      </div>

      {/* Date badge */}
      <div style={{ marginTop: 10 }}>
        <span style={{
          background: "#fff0f0", color: "#c0392b", border: "1px solid #f5c6c6",
          borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 600
        }}>
          📅 Today — 29 Jun 2026
        </span>
      </div>
    </div>
  );
}

export default function BongeRidersApp() {
  const [showPin, setShowPin] = useState(false);
  const [dashboardUnlocked, setDashboardUnlocked] = useState(false);

  return (
    <div style={{
      fontFamily: "'Segoe UI', sans-serif", maxWidth: 420, margin: "0 auto",
      minHeight: "100vh", background: "#f7f7f7", paddingBottom: 40
    }}>
      {showPin && (
        <PinModal
          onSuccess={() => { setDashboardUnlocked(true); setShowPin(false); }}
          onClose={() => setShowPin(false)}
        />
      )}

      {/* Header */}
      <div style={{
        background: "#fff", padding: "14px 16px",
        borderBottom: "1px solid #eee", display: "flex",
        justifyContent: "space-between", alignItems: "center"
      }}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>
          BO<span style={{ color: "#c0392b" }}>GONKO-NGELANI</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 34, height: 34, fontSize: 16, cursor: "pointer" }}>↺</button>
          <button style={{ background: "#2ecc71", border: "none", borderRadius: "50%", width: 34, height: 34, fontSize: 16, cursor: "pointer", color: "#fff" }}>✎</button>
        </div>
      </div>

      <div style={{ padding: "16px" }}>

        {/* Dashboard Panel — only visible after PIN */}
        {dashboardUnlocked && (
          <DashboardPanel onClose={() => setDashboardUnlocked(false)} />
        )}

        {/* Logo + Hero */}
        <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
          <div style={{
            width: 100, height: 100, borderRadius: "50%", background: "#fff",
            border: "3px solid #eee", margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.10)"
          }}>
            {/* Logo placeholder — in real app, use actual logo */}
            <div style={{ fontSize: 12, fontWeight: 800, color: "#c0392b", textAlign: "center", lineHeight: 1.2 }}>
              BONGE<br/>RIDERS
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, textAlign: "left" }}>
            Stronger Together,<br />
            <span style={{ color: "#c0392b" }}>Riding Forward.</span>
          </div>
          <div style={{ color: "#888", fontSize: 14, textAlign: "left", marginTop: 4 }}>
            Bonge Riders Welfare Association
          </div>
        </div>

        {/* Join / Login buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button style={{
            flex: 1, padding: "13px 0", background: "#c0392b", color: "#fff",
            border: "none", borderRadius: 30, fontSize: 15, fontWeight: 700, cursor: "pointer"
          }}>👤 Join Us</button>
          <button style={{
            flex: 1, padding: "13px 0", background: "#fff", color: "#c0392b",
            border: "2px solid #c0392b", borderRadius: 30, fontSize: 15, fontWeight: 700, cursor: "pointer"
          }}>🔒 Member Login</button>
        </div>

        {/* Sign-in required notice */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: "14px 16px",
          textAlign: "center", marginBottom: 12, border: "1px solid #eee"
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🔒 SIGN IN REQUIRED</div>
          <div style={{ fontSize: 13, color: "#666" }}>
            This tracker contains private member information.<br />
            Members can view the totals dashboard with the group PIN.
          </div>
        </div>

        {/* Enter Dashboard PIN button */}
        <button
          onClick={() => setShowPin(true)}
          style={{
            width: "100%", padding: "14px 0", background: "#c0392b",
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 10
          }}>
          🔢 Enter Dashboard PIN
        </button>

        {/* Admin Login */}
        <button style={{
          width: "100%", padding: "13px 0", background: "#fff",
          color: "#444", border: "1px solid #ddd", borderRadius: 12,
          fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 20
        }}>
          🔓 Admin Login
        </button>

        {/* Welfare Benefit card */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "20px 16px",
          textAlign: "center", border: "1px solid #eee", marginBottom: 16
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", background: "#f5f5f5",
            margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#c0392b"
          }}>BONGE<br/>RIDERS</div>
          <div style={{ fontWeight: 800, fontSize: 16, textDecoration: "underline", marginBottom: 8 }}>
            WELFARE BENEFIT
          </div>
          <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6 }}>
            Active members are entitled to welfare support in times of need. Stay up to date with contributions to remain eligible.
          </div>
        </div>

        {/* User Manual */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          border: "1px solid #eee", marginBottom: 10
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>📖</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>User Manual</div>
              <div style={{ fontSize: 12, color: "#888" }}>How to use the Bonge Riders app</div>
            </div>
          </div>
          <button style={{
            background: "#fff0f0", color: "#c0392b", border: "1px solid #f5c6c6",
            borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer"
          }}>⬇ Download</button>
        </div>

        {/* FAQ */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          border: "1px solid #eee"
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 22, color: "#c0392b" }}>?</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Frequently Asked Questions</div>
              <div style={{ fontSize: 12, color: "#888" }}>Tap a question to expand the answer</div>
            </div>
          </div>
          <span style={{ color: "#888" }}>›</span>
        </div>

      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 11, color: "#aaa", paddingTop: 10 }}>
        © Bogonko-Ngelani Stage · Privacy Policy · Terms &amp; Conditions
      </div>
    </div>
  );
}
