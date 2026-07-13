import React from 'react';

export default function LimitModal({ isOpen, onClose, featureName, limitValue }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-[#0B0F1D]/95 border-2 border-[#7C3AED]/40 rounded-3xl p-6 shadow-2xl relative text-center space-y-5"
        onClick={e => e.stopPropagation()}
        style={{
          animation: 'modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
        }}
      >
        {/* Glowing Aura */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#7C3AED]/5 to-transparent rounded-3xl pointer-events-none" />

        {/* Crown Icon */}
        <div className="mx-auto w-14 h-14 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/30 flex items-center justify-center text-2xl animate-bounce">
          👑
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">Limit Reached!</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            You've exhausted your free daily limit of <strong className="text-[#A78BFA]">{limitValue} {featureName}s</strong>. 
          </p>
          <p className="text-[10px] text-slate-500">
            Upgrade to Pro or Business tier to get unlimited access, higher performance and all premium templates.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('fic_navigate_tab', { detail: 'upgrade' }));
              onClose();
            }}
            className="w-full py-3 bg-gradient-to-r from-[#7C3AED] to-[#0EA5E9] hover:opacity-95 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all cursor-pointer block text-center"
          >
            Upgrade Now
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] text-slate-400 hover:text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
      
      {/* Mini animations */}
      <style>{`
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.9) translateY(40px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
