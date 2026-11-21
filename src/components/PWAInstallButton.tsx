import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Install Bangla Highway Coach 3D App"
        className={
          compact
            ? 'h-10 px-2 sm:px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0'
            : 'flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-display font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-4 h-4" />
        <span className={compact ? 'hidden sm:inline' : ''}>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          title="Install on iPhone / iPad"
          className={
            compact
              ? 'h-10 px-2 sm:px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-400/50 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0'
              : 'flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-amber-200 bg-slate-800 hover:bg-slate-700 border border-amber-400/40 transition-colors cursor-pointer whitespace-nowrap shrink-0'
          }
        >
          <Smartphone className="w-4 h-4" />
          <span className={compact ? 'hidden sm:inline' : ''}>Add App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4">
            <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-white">
                  Install on iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  aria-label="Close instructions"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs sm:text-sm text-slate-300 space-y-2 leading-relaxed">
                <p className="flex items-center gap-2">
                  <span>1. Tap the</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-semibold">
                    <Share className="w-3.5 h-3.5" /> Share
                  </span>
                  <span>button in Safari.</span>
                </p>
                <p>
                  2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                </p>
                <p className="font-bangla text-amber-300/90 text-xs pt-1">
                  হোম স্ক্রিনে যোগ করলে গেমটি অফলাইনেও অ্যাপের মতো চলবে।
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
