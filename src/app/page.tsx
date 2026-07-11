"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FlaskConical, Eye, EyeOff, ArrowRight, ShieldCheck, BarChart3, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const redirectedFrom = searchParams.get("redirectedFrom");
    router.push(redirectedFrom ?? "/dashboard");
    router.refresh();
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .el-root {
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
          background: #080c0a;
        }

        .el-glow-1 {
          position: fixed;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 600px;
          background: radial-gradient(ellipse, rgba(34,197,94,0.18) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .el-glow-2 {
          position: fixed;
          bottom: -100px;
          right: -100px;
          width: 500px;
          height: 500px;
          background: radial-gradient(ellipse, rgba(34,197,94,0.10) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .el-glow-3 {
          position: fixed;
          bottom: 100px;
          left: -150px;
          width: 400px;
          height: 400px;
          background: radial-gradient(ellipse, rgba(34,197,94,0.07) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        .el-card {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          width: 100%;
          max-width: 960px;
          min-height: 560px;
          border-radius: 24px;
          border: 1px solid rgba(34,197,94,0.15);
          background: rgba(10,16,12,0.75);
          backdrop-filter: blur(24px);
          overflow: hidden;
          box-shadow: 0 0 80px rgba(34,197,94,0.06), 0 32px 64px rgba(0,0,0,0.5);
        }

        .el-left {
          padding: 52px 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          border-right: 1px solid rgba(34,197,94,0.1);
        }

        .el-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 40px;
        }
        .el-logo-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
        }
        .el-logo-text {
          font-size: 18px;
          font-weight: 600;
          color: #f0fdf4;
          letter-spacing: -0.3px;
        }
        .el-logo-sub {
          font-size: 11px;
          color: #4ade80;
          font-weight: 500;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-top: 1px;
        }

        .el-welcome {
          font-size: 26px;
          font-weight: 700;
          color: #f0fdf4;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }
        .el-welcome-sub {
          font-size: 14px;
          color: #7ebd93;
          margin-bottom: 32px;
        }

        .el-form { display: flex; flex-direction: column; gap: 16px; }

        .el-field label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #6ee7b7;
          letter-spacing: 0.4px;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .el-input-wrap { position: relative; }

        .el-input-wrap input {
          width: 100%;
          height: 44px;
          background: rgba(34,197,94,0.06);
          border: 1px solid rgba(34,197,94,0.15);
          border-radius: 10px;
          padding: 0 16px;
          font-size: 14px;
          color: #f0fdf4;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .el-input-wrap input::placeholder { color: #2d5a3d; }
        .el-input-wrap input:focus {
          border-color: rgba(34,197,94,0.4);
          background: rgba(34,197,94,0.09);
        }
        .el-input-wrap input.has-toggle { padding-right: 44px; }

        .el-toggle-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #4b7a5a;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        .el-toggle-btn:hover { color: #22c55e; }

        .el-forgot {
          text-align: right;
          margin-top: -8px;
        }
        .el-forgot a {
          font-size: 12px;
          color: #4ade80;
          text-decoration: none;
        }
        .el-forgot a:hover { color: #86efac; }

        .el-error {
          font-size: 13px;
          color: #f87171;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px;
          padding: 10px 14px;
        }

        .el-btn {
          height: 46px;
          background: #16a34a;
          border: none;
          border-radius: 10px;
          color: #f0fdf4;
          font-size: 15px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
          box-shadow: 0 0 32px rgba(34,197,94,0.25), 0 4px 12px rgba(0,0,0,0.3);
          transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
        }
        .el-btn:hover:not(:disabled) {
          background: #15803d;
          box-shadow: 0 0 48px rgba(34,197,94,0.35), 0 4px 12px rgba(0,0,0,0.3);
        }
        .el-btn:active:not(:disabled) { transform: scale(0.99); }
        .el-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .el-register {
          text-align: center;
          font-size: 13px;
          color: #7ebd93;
          margin-top: 4px;
        }
        .el-register a {
          color: #4ade80;
          text-decoration: none;
          font-weight: 500;
        }
        .el-register a:hover { color: #86efac; }

        .el-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(240,253,244,0.3);
          border-top-color: #f0fdf4;
          border-radius: 50%;
          animation: el-spin 0.7s linear infinite;
        }
        @keyframes el-spin { to { transform: rotate(360deg); } }

        .el-right {
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 52px 48px;
        }
        .el-right-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(10,16,12,0) 60%);
          pointer-events: none;
        }
        .el-right-glow {
          position: absolute;
          top: -80px;
          right: -80px;
          width: 300px;
          height: 300px;
          background: radial-gradient(ellipse, rgba(34,197,94,0.2) 0%, transparent 70%);
          pointer-events: none;
        }
        .el-right-content { position: relative; z-index: 1; }

        .el-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.25);
          border-radius: 20px;
          padding: 5px 12px;
          font-size: 11px;
          font-weight: 600;
          color: #4ade80;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 24px;
        }
        .el-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e;
          animation: el-pulse 2s ease-in-out infinite;
        }
        @keyframes el-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .el-headline {
          font-size: 28px;
          font-weight: 700;
          color: #f0fdf4;
          letter-spacing: -0.5px;
          line-height: 1.25;
          margin-bottom: 12px;
        }
        .el-headline span { color: #4ade80; }

        .el-sub {
          font-size: 14px;
          color: #7ebd93;
          line-height: 1.6;
          margin-bottom: 36px;
        }

        .el-stats { display: flex; flex-direction: column; gap: 16px; }

        .el-stat {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px;
          background: rgba(34,197,94,0.05);
          border: 1px solid rgba(34,197,94,0.1);
          border-radius: 12px;
          transition: border-color 0.2s, background 0.2s;
        }
        .el-stat:hover {
          border-color: rgba(34,197,94,0.2);
          background: rgba(34,197,94,0.08);
        }
        .el-stat-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(34,197,94,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
          flex-shrink: 0;
        }
        .el-stat-label {
          font-size: 13px;
          font-weight: 600;
          color: #d1fae5;
          margin-bottom: 2px;
        }
        .el-stat-desc {
          font-size: 12px;
          color: #7ebd93;
          line-height: 1.4;
        }

        .el-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(34,197,94,0.2), transparent);
          margin: 28px 0;
        }

        .el-target { display: flex; align-items: center; gap: 12px; }
        .el-target-score {
          font-size: 36px;
          font-weight: 700;
          color: #22c55e;
          letter-spacing: -1px;
          line-height: 1;
          text-shadow: 0 0 20px rgba(34,197,94,0.4);
        }
        .el-target-label { font-size: 12px; color: #7ebd93; line-height: 1.4; }
        .el-target-label strong {
          display: block;
          color: #86efac;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 2px;
        }

        @media (max-width: 700px) {
          .el-card { grid-template-columns: 1fr; min-height: unset; }
          .el-right { display: none; }
          .el-left { padding: 40px 28px; }
        }
      `}</style>

      <div className="el-root">
        <div className="el-glow-1" />
        <div className="el-glow-2" />
        <div className="el-glow-3" />

        <div className="el-card">
          {/* LEFT — Login */}
          <div className="el-left">
            <div className="el-logo">
              <div className="el-logo-icon">
                <FlaskConical size={18} />
              </div>
              <div>
                <div className="el-logo-text">fionnuala</div>
                <div className="el-logo-sub">AI Knowledge Base</div>
              </div>
            </div>

            <h1 className="el-welcome">Welcome back</h1>
            <p className="el-welcome-sub">Sign in to your evaluation workspace</p>

            <form className="el-form" onSubmit={handleSubmit}>
              <div className="el-field">
                <label>Email address</label>
                <div className="el-input-wrap">
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="el-field">
                <label>Password</label>
                <div className="el-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="has-toggle"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="el-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && <div className="el-error" role="alert">{error}</div>}

              <button type="submit" className="el-btn" disabled={loading}>
                {loading ? (
                  <div className="el-spinner" />
                ) : (
                  <>Sign in <ArrowRight size={16} /></>
                )}
              </button>

              </form>
          </div>

          {/* RIGHT — Value prop */}
          <div className="el-right">
            <div className="el-right-bg" />
            <div className="el-right-glow" />
            <div className="el-right-content">
              <div className="el-badge">
                <div className="el-badge-dot" />
                Eval engine online
              </div>

              <h2 className="el-headline">
                Not guessing.<br />
                <span>Measuring.</span>
              </h2>
              <p className="el-sub">
                A scientific laboratory for grounded RAG. Every answer scored against your documents — no hallucinations, no vibe checks.
              </p>

              <div className="el-stats">
                <div className="el-stat">
                  <div className="el-stat-icon"><ShieldCheck size={18} /></div>
                  <div>
                    <div className="el-stat-label">Faithfulness scoring</div>
                    <div className="el-stat-desc">Every answer mathematically verified against your source documents</div>
                  </div>
                </div>
                <div className="el-stat">
                  <div className="el-stat-icon"><BarChart3 size={18} /></div>
                  <div>
                    <div className="el-stat-label">A/B experimentation</div>
                    <div className="el-stat-desc">Compare chunk configs head-to-head. Auto-winner promoted to production</div>
                  </div>
                </div>
                <div className="el-stat">
                  <div className="el-stat-icon"><Zap size={18} /></div>
                  <div>
                    <div className="el-stat-label">Deploy via API key</div>
                    <div className="el-stat-desc">Connect any website to your verified knowledge base in minutes</div>
                  </div>
                </div>
              </div>

              <div className="el-divider" />

              <div className="el-target">
                <div className="el-target-score">90%+</div>
                <div className="el-target-label">
                  <strong>Faithfulness target</strong>
                  Minimum threshold before any config is promoted to production
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
