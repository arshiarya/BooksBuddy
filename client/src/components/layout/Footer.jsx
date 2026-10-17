import React from 'react';
import { ShieldCheck, Heart } from 'lucide-react';
import { Logo } from '../common/Logo';

export function Footer() {
  return (
    <footer className="bg-[#FAF7F2] border-t border-[#DDCFC0] mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-3">
            <Logo variant="compact" size="sm" />
            <span className="hidden sm:inline text-muted/60">&bull;</span>
            <span className="hidden sm:inline font-medium">
              Community-Based Virtual Library
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-forest font-semibold">
              <ShieldCheck className="w-4 h-4 text-forest shrink-0" />
              Privacy-Preserving Physical Custody
            </span>
            <span className="text-muted/60">&bull;</span>
            <span className="inline-flex items-center gap-1">
              Built for trusted neighborhood communities
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
