import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL as API_URL } from '../config/api';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function UpgradePlan({ setCurrentTab }) {
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // 'idle', 'processing', 'success'

  const scrollToTable = () => {
    const el = document.getElementById('comparison-table-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUpgradeClick = async (plan) => {
    const email = localStorage.getItem('fic_user_email');
    if (!email) {
      window.dispatchEvent(new CustomEvent('fic_login_required', {
        detail: { callback: () => handleUpgradeClick(plan) }
      }));
      return;
    }

    setCheckoutPlan(plan);
    setPaymentStatus('processing');

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        alert('Failed to load Razorpay payment SDK. Please check your internet connection.');
        setCheckoutPlan(null);
        setPaymentStatus('idle');
        return;
      }

      // 1. Create order on backend
      const res = await axios.post(`${API_URL}/api/payment/create-order`, {
        email,
        planType: plan.type
      });

      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to create order');
      }

      const orderData = res.data;

      // 2. Configure & Open Razorpay checkout options
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'FIC AI Premium',
        description: `Upgrade to ${plan.name}`,
        order_id: orderData.orderId,
        prefill: {
          email: email
        },
        theme: {
          color: '#7C3AED'
        },
        handler: async function (response) {
          try {
            setPaymentStatus('processing');
            // 3. Verify payment signature on backend
            const verifyRes = await axios.post(`${API_URL}/api/payment/verify-payment`, {
              email,
              planType: plan.type,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verifyRes.data.success) {
              setPaymentStatus('success');
              localStorage.setItem('fic_user_tier', plan.type);
              window.dispatchEvent(new Event('fic_user_login_state_changed'));
            } else {
              alert('Payment verification failed.');
              setCheckoutPlan(null);
              setPaymentStatus('idle');
            }
          } catch (verifyErr) {
            console.error('Verification error:', verifyErr);
            alert('Verification failed: ' + (verifyErr.response?.data?.error || verifyErr.message));
            setCheckoutPlan(null);
            setPaymentStatus('idle');
          }
        },
        modal: {
          ondismiss: function () {
            setCheckoutPlan(null);
            setPaymentStatus('idle');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Order creation failed:', err);
      alert('Order creation failed: ' + (err.response?.data?.error || err.message));
      setCheckoutPlan(null);
      setPaymentStatus('idle');
    }
  };

  const handleCloseCheckout = () => {
    setCheckoutPlan(null);
    setPaymentStatus('idle');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none bg-[#060814]" style={{ color: 'var(--text-color)' }}>
      {/* Top Header */}
      <div className="h-16 px-6 pr-28 border-b border-white/5 bg-[#0B1020]/50 backdrop-blur-md flex items-center justify-between shrink-0 no-print">
        <div className="flex flex-col">
          <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
            👑 Upgrade Plan
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Choose the perfect plan for your AI journey</p>
        </div>
        <button
          onClick={scrollToTable}
          className="py-1.5 px-3 bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-gray-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>⚖️</span> Compare Plans
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-8 scrollbar-thin">
        
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#2e0854] via-[#7C3AED]/20 to-[#0EA5E9]/15 border border-[#7C3AED]/35 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          {/* Glowing Aura */}
          <div className="absolute w-64 h-64 bg-[#7C3AED]/10 blur-3xl -top-12 -right-12 rounded-full pointer-events-none" />
          <div className="absolute w-48 h-48 bg-[#0EA5E9]/5 blur-3xl -bottom-12 -left-12 rounded-full pointer-events-none" />
          
          <div className="space-y-3 z-10 text-center md:text-left">
            <div className="inline-flex flex-wrap justify-center md:justify-start items-center gap-3 text-[9px] text-[#A78BFA] font-black uppercase tracking-wider bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-full">
              <span>🛡️ Cancel anytime</span>
              <span className="opacity-40">•</span>
              <span>🔒 Secure payment</span>
              <span className="opacity-40">•</span>
              <span>⚡ Instant access</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Unlock All Premium Features</h3>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Upgrade now and experience the power of unlimited creativity with AI. Unlock faster processing, higher limits, and advanced content creation capabilities.
            </p>
          </div>

          <div className="shrink-0 z-10 relative">
            {/* Animated Glow SVG Crown */}
            <div className="relative animate-float">
              <div className="absolute inset-0 bg-[#A78BFA]/20 blur-xl rounded-full scale-75 animate-pulse" />
              <svg className="w-24 h-24 text-[#A78BFA] filter drop-shadow-[0_0_15px_rgba(167,139,250,0.6)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 22h20v-2H2v2zm2-4h16V9l-4 4-4-6-4 6-4-4v9z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          
          {/* Card 1: Free Plan */}
          <div className="bg-[#0B0F1D]/40 border border-white/5 p-6 rounded-2xl flex flex-col justify-between hover:border-white/10 transition-all duration-300 relative group">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perfect for getting started</span>
                <h4 className="text-lg font-black text-white uppercase tracking-wider mt-1">Free Plan</h4>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">₹0</span>
                <span className="text-xs text-slate-500">/month</span>
              </div>
              <button
                disabled
                className="w-full py-3 bg-white/[0.03] border border-white/5 text-slate-500 font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-not-allowed text-center block"
              >
                Current Plan
              </button>
              
              <hr className="border-white/5 my-2" />
              
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span><strong>20</strong> AI Chats / day</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span><strong>3</strong> Image Generations / day</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span><strong>2</strong> Document Generations / day</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span><strong>4</strong> Poster Generations / day</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span><strong>1</strong> Video Generation / day</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span><strong>5</strong> Voice Generations / day</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span><strong>3</strong> Resume Builds / day</span>
                </li>
                <li className="flex items-start gap-2.5 opacity-40">
                  <span className="text-rose-500 shrink-0">✗</span>
                  <span>ATS Analysis & Score</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 2: Pro Plan */}
          <div className="bg-[#0B0F1D]/80 border-2 border-[#7C3AED] p-6 rounded-2xl flex flex-col justify-between shadow-[0_0_30px_rgba(124,58,237,0.15)] relative hover:scale-[1.02] transition-all duration-300">
            {/* Most Popular Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#7C3AED] to-[#0EA5E9] text-white text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-full shadow-md">
              Most Popular
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#A78BFA]">Best for professionals</span>
                <h4 className="text-lg font-black text-white uppercase tracking-wider mt-1 flex items-center gap-1.5">
                  <span>⭐</span> Pro Plan
                </h4>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">₹499</span>
                  <span className="text-xs text-slate-400">/month</span>
                </div>
                <span className="text-[9px] text-[#A78BFA] font-bold block mt-0.5">₹5,988 billed yearly (Save 20%)</span>
              </div>
              <button
                onClick={() => handleUpgradeClick({ name: 'Pro Plan', price: '₹499', type: 'pro' })}
                className="w-full py-3 bg-gradient-to-r from-[#7C3AED] to-[#0EA5E9] hover:opacity-90 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all cursor-pointer text-center block"
              >
                Upgrade to Pro
              </button>
              
              <hr className="border-white/10 my-2" />
              
              <ul className="space-y-2.5 text-xs text-slate-200">
                <li className="flex items-start gap-2.5">
                  <span className="text-cyan-400 shrink-0">✓</span>
                  <span><strong>Unlimited</strong> AI Chats</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-cyan-400 shrink-0">✓</span>
                  <span><strong>Unlimited</strong> Image Generations</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-cyan-400 shrink-0">✓</span>
                  <span><strong>Unlimited</strong> Poster Generations</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-cyan-400 shrink-0">✓</span>
                  <span><strong>100</strong> Video Generations / month</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-cyan-400 shrink-0">✓</span>
                  <span><strong>Unlimited</strong> Voice Generations</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-cyan-400 shrink-0">✓</span>
                  <span><strong>Unlimited</strong> Resume Builder</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-cyan-400 shrink-0">✓</span>
                  <span>ATS Analysis & Resume Score</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 3: Business Plan */}
          <div className="bg-[#0B0F1D]/40 border border-white/5 p-6 rounded-2xl flex flex-col justify-between hover:border-white/10 transition-all duration-300 relative group">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Best for teams & companies</span>
                <h4 className="text-lg font-black text-white uppercase tracking-wider mt-1 flex items-center gap-1.5">
                  <span>👑</span> Business Plan
                </h4>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">₹999</span>
                  <span className="text-xs text-slate-500">/month</span>
                </div>
                <span className="text-[9px] text-[#F59E0B] font-bold block mt-0.5">₹11,988 billed yearly (Save 20%)</span>
              </div>
              <button
                onClick={() => handleUpgradeClick({ name: 'Business Plan', price: '₹999', type: 'business' })}
                className="w-full py-3 bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:opacity-90 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all cursor-pointer text-center block"
              >
                Upgrade to Business
              </button>
              
              <hr className="border-white/5 my-2" />
              
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2.5 text-amber-300 font-semibold">
                  <span className="shrink-0">✓</span>
                  <span>Everything in Pro Plan</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 shrink-0">✓</span>
                  <span>Invoice & Proposal Generator</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 shrink-0">✓</span>
                  <span>Business Templates</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 shrink-0">✓</span>
                  <span>Priority 24/7 Support</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 shrink-0">✓</span>
                  <span>Advanced Custom Branding</span>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Detailed Comparison Table */}
        <div id="comparison-table-section" className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-base">⚖️</span>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">All Features Comparison</h3>
          </div>
          
          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#0B0F1D]/30 backdrop-blur-md">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-[#0E1325]/50">
                  <th className="p-4 font-black uppercase text-slate-400 tracking-wider">Feature</th>
                  <th className="p-4 font-black uppercase text-slate-400 tracking-wider">Free</th>
                  <th className="p-4 font-black uppercase text-[#A78BFA] tracking-wider">Pro</th>
                  <th className="p-4 font-black uppercase text-[#F59E0B] tracking-wider">Business</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">💬 AI Chat</td>
                  <td className="p-4 text-slate-300">20 / day</td>
                  <td className="p-4 text-cyan-400 font-extrabold">Unlimited</td>
                  <td className="p-4 text-amber-400 font-extrabold">Unlimited</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">🎨 Image Generator</td>
                  <td className="p-4 text-slate-300">3 / day</td>
                  <td className="p-4 text-cyan-400 font-extrabold">Unlimited</td>
                  <td className="p-4 text-amber-400 font-extrabold">Unlimited</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">📁 Document Generator</td>
                  <td className="p-4 text-slate-300">2 / day</td>
                  <td className="p-4 text-cyan-400 font-extrabold">Unlimited</td>
                  <td className="p-4 text-amber-400 font-extrabold">Unlimited</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">🖌️ Image Editor</td>
                  <td className="p-4 text-emerald-400 text-sm font-bold">✅</td>
                  <td className="p-4 text-emerald-400 text-sm font-bold">✅</td>
                  <td className="p-4 text-emerald-400 text-sm font-bold">✅</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">✏️ Poster Generator</td>
                  <td className="p-4 text-slate-300">4 / day</td>
                  <td className="p-4 text-cyan-400 font-extrabold">Unlimited</td>
                  <td className="p-4 text-amber-400 font-extrabold">Unlimited</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">📹 Video Generator</td>
                  <td className="p-4 text-slate-300">1 / day</td>
                  <td className="p-4 text-cyan-400 font-extrabold">100 / month</td>
                  <td className="p-4 text-amber-400 font-extrabold">Unlimited</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">🎙️ Voice AI</td>
                  <td className="p-4 text-slate-300">5 / day</td>
                  <td className="p-4 text-cyan-400 font-extrabold">Unlimited</td>
                  <td className="p-4 text-amber-400 font-extrabold">Unlimited</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">📄 Resume Builder</td>
                  <td className="p-4 text-slate-300">3 / day</td>
                  <td className="p-4 text-cyan-400 font-extrabold">Unlimited</td>
                  <td className="p-4 text-amber-400 font-extrabold">Unlimited</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">📊 ATS Analysis</td>
                  <td className="p-4 text-rose-500 text-sm font-bold">❌</td>
                  <td className="p-4 text-emerald-400 text-sm font-bold">✅</td>
                  <td className="p-4 text-emerald-400 text-sm font-bold">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Checkout Modal Overlay */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn" onClick={handleCloseCheckout}>
          <div 
            className="w-full max-w-md bg-[#0B0F1D]/95 border border-[#7C3AED]/30 rounded-3xl p-6 shadow-2xl relative space-y-6"
            onClick={e => e.stopPropagation()}
            style={{
              animation: 'modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={handleCloseCheckout} 
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center justify-center text-sm cursor-pointer transition-colors"
            >
              ✕
            </button>

            {paymentStatus === 'processing' && (
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                <svg className="animate-spin h-10 w-10 text-[#A78BFA]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <div className="space-y-1">
                  <span className="text-sm font-black text-white uppercase tracking-wider block">Verifying Payment...</span>
                  <span className="text-[10px] text-slate-500 block">Do not close this window or click back</span>
                </div>
              </div>
            )}

            {paymentStatus === 'success' && (
              <div className="py-8 flex flex-col items-center justify-center gap-5 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-3xl shadow-lg animate-bounce">
                  ✓
                </div>
                <div className="space-y-2">
                  <h4 className="text-lg font-black text-white uppercase tracking-tight">Payment Successful! 🎉</h4>
                  <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
                    Thank you! Your account has been upgraded to the premium tier. All unlimited features are now active.
                  </p>
                </div>
                <button
                  onClick={handleCloseCheckout}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#10B981] to-[#059669] hover:opacity-90 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md cursor-pointer"
                >
                  🚀 Get Started
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Floating animation styling */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.9) translateY(40px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
