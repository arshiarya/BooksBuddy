import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Server, Shield, Database, Radio } from 'lucide-react';

export default function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch health status:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6">
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="bg-brand-600 text-white p-2.5 rounded-xl shadow-sm">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">BooksBuddy</h1>
            <p className="text-xs text-slate-500 font-medium">Community-Based Virtual Library</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Phase 1 Active
        </span>
      </header>

      <main className="max-w-4xl mx-auto w-full my-auto py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Project Foundation & Health Monitor</h2>
            <p className="text-slate-600 mt-1">
              Phase 1 setup complete: React + Tailwind CSS client connected to Express.js modular monolith backend.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backend Health Check Card */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-sm text-slate-700">
                  <Server className="w-4 h-4 text-brand-600" />
                  Backend Health Status
                </span>
                {loading ? (
                  <span className="text-xs text-slate-400">Pinging /health...</span>
                ) : error ? (
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded">Disconnected</span>
                ) : (
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {health?.status?.toUpperCase()}
                  </span>
                )}
              </div>

              {health && (
                <div className="text-xs text-slate-600 font-mono space-y-1 bg-white p-3 rounded-lg border border-slate-200">
                  <div><span className="text-slate-400">Service:</span> {health.service}</div>
                  <div><span className="text-slate-400">Environment:</span> {health.environment}</div>
                  <div><span className="text-slate-400">Uptime:</span> {Math.round(health.uptime)}s</div>
                  <div><span className="text-slate-400">Server Time:</span> {new Date(health.timestamp).toLocaleTimeString()}</div>
                </div>
              )}

              {error && (
                <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-200">
                  Unable to reach <code className="font-mono">/health</code>. Ensure backend server is running on port 5000.
                </div>
              )}
            </div>

            {/* Architecture Stack Checklist */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <span className="flex items-center gap-2 font-semibold text-sm text-slate-700">
                <Shield className="w-4 h-4 text-brand-600" />
                Phase 1 Validated Standards
              </span>
              <ul className="text-xs text-slate-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Vite + React (JavaScript) + Tailwind CSS client</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Express.js modular monolith with Helmet & CORS</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Cookie-parser & environment configuration validation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Vite reverse proxy configured for backend routing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-400 pt-6 border-t border-slate-200">
        BooksBuddy Architecture &bull; Clean, Modular Monolith &bull; Ready for Phase 2 Database Migrations
      </footer>
    </div>
  );
}
