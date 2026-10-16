import React from 'react';
import { BookOpen, Heart, ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-600" />
            <span className="font-semibold text-slate-700">BooksBuddy</span>
            <span>&bull;</span>
            <span>Decentralized Community-Based Virtual Library</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Privacy-Preserving Physical Custody
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              Built with care for neighborhoods
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
