'use client';

import React from 'react';
import Logo from './Logo';
import { ShieldCheck, Phone, Mail, MapPin, Globe, ExternalLink, Award } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[#05150f]/90 backdrop-blur-2xl border-t border-emerald-900/40 text-slate-300 mt-16 pt-12 pb-8 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Company Info Header */}
          <div className="md:col-span-6 space-y-4">
            <Logo size="lg" showSubtitle={true} href="/" />
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              <strong className="text-slate-200">Oneuni Agri Platform Pvt Ltd</strong> is a DPIIT-recognised agri-tech startup from Salem, Tamil Nadu, building unified, neutral discovery platforms for Indian agriculture.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" /> DPIIT Recognised Startup
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 font-medium">
                Incorporated 2025
              </span>
            </div>
          </div>

          {/* Ecosystem Family Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Our Platform Family</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://agri.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 flex items-center gap-1.5 transition-colors group"
                >
                  <span className="font-semibold text-white group-hover:text-emerald-300">Agri.in</span>
                  <span className="text-[10px] text-slate-400">— India's Agri Super App</span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://milk.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 flex items-center gap-1.5 transition-colors group"
                >
                  <span className="font-semibold text-white group-hover:text-emerald-300">Milk.in</span>
                  <span className="text-[10px] text-slate-400">— Hyperlocal Dairy Discovery</span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://theorganic.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 flex items-center gap-1.5 transition-colors group"
                >
                  <span className="font-semibold text-white group-hover:text-emerald-300">TheOrganic.in</span>
                  <span className="text-[10px] text-slate-400">— Verified Organic Platform</span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://agricoins.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 flex items-center gap-1.5 transition-colors group"
                >
                  <span className="font-semibold text-amber-300 group-hover:text-amber-200">AgriCoins & AgriID</span>
                  <span className="text-[10px] text-slate-400">— Identity & Loyalty</span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                </a>
              </li>
            </ul>
          </div>

          {/* Contact & Location */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Headquarters & Contact</h4>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Salem District, Tamil Nadu, India</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href="tel:+917998822221" className="hover:text-white transition-colors">+91 79988 22221</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href="mailto:arun@agri.in" className="hover:text-white transition-colors">arun@agri.in</a>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href="https://oneuni.in" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">https://oneuni.in</a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright Strip */}
        <div className="pt-6 border-t border-emerald-900/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} Oneuni Agri Platform Pvt Ltd. All rights reserved. The company behind Agri.in.</p>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Designed & Developed in India 🇮🇳</span>
            <span className="text-emerald-500/40">•</span>
            <span className="text-emerald-400 font-semibold">EMS v2.0 Enterprise</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
