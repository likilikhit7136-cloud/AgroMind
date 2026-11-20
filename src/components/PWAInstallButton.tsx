import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  showAlwaysInSettings?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  showAlwaysInSettings = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled && !showAlwaysInSettings) {
    return null;
  }

  if (isInstalled && showAlwaysInSettings) {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-[#15803D]">
        Installed on this device
      </span>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-2 rounded-lg border border-[#D4DDD5] bg-white text-[#141A15] font-medium hover:bg-[#F1F4F1] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166534] ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-sm'
        }`}
      >
        <Download className="w-4 h-4 text-[#166534]" />
        Install App
      </button>
    );
  }

  if (isIOS || showAlwaysInSettings) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={`inline-flex items-center gap-2 rounded-lg border border-[#D4DDD5] bg-white text-[#141A15] font-medium hover:bg-[#F1F4F1] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166534] ${
            compact ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-sm'
          }`}
        >
          <Smartphone className="w-4 h-4 text-[#166534]" />
          {isIOS ? 'Install on iOS' : 'Mobile App Setup'}
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-guide-title"
          >
            <div className="w-full max-w-md rounded-xl border border-[#E4E7E2] bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="pwa-guide-title" className="text-lg font-semibold text-[#141A15]">
                    Install PlantWise on iOS &amp; Android
                  </h3>
                  <p className="mt-1 text-sm text-[#556157]">
                    Run PlantWise offline in remote fields and receive instant plant health notifications.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close installation guide"
                  className="p-1.5 rounded-lg text-[#556157] hover:bg-[#F1F4F1] hover:text-[#141A15]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4 text-sm text-[#2A332C]">
                <div className="pb-4 border-b border-[#E4E7E2]">
                  <p className="font-semibold text-[#141A15]">iPhone &amp; iPad (Safari)</p>
                  <ol className="mt-1.5 space-y-1 text-[#556157] list-decimal list-inside">
                    <li>Tap the Share icon in Safari&apos;s bottom toolbar.</li>
                    <li>Scroll down and tap <strong className="text-[#141A15]">Add to Home Screen</strong>.</li>
                    <li>Launch PlantWise from your home screen to unlock iOS Web Push alerts.</li>
                  </ol>
                </div>

                <div>
                  <p className="font-semibold text-[#141A15]">Android (Chrome / Edge)</p>
                  <ol className="mt-1.5 space-y-1 text-[#556157] list-decimal list-inside">
                    <li>Open the browser menu (three dots) in the top right.</li>
                    <li>Tap <strong className="text-[#141A15]">Install app</strong> or <strong className="text-[#141A15]">Add to Home screen</strong>.</li>
                    <li>Allow notification permissions when prompted for real-time crop alerts.</li>
                  </ol>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#166534] rounded-lg hover:bg-[#14532D] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
