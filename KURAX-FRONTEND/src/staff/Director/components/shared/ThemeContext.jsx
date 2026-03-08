import React from "react";

export const ThemeContext = React.createContext({ dark: true, t: {} });
export function useTheme() { return React.useContext(ThemeContext); }

export function buildTheme(dark) {
  return {
    bg:        dark ? "bg-[#0a0a0a]"                  : "bg-[#f4f0e8]",
    sidebar:   dark ? "bg-[#050505] border-white/5"    : "bg-white border-zinc-200",
    header:    dark ? "bg-[#050505]/90 border-white/5"  : "bg-white/90 border-zinc-200",
    card:      dark ? "bg-zinc-900/40 border-white/5"   : "bg-white border-zinc-200",
    text:      dark ? "text-slate-200"  : "text-zinc-900",
    subtext:   dark ? "text-zinc-500"   : "text-zinc-500",
    input:     dark ? "bg-black border-white/10 text-white placeholder-zinc-600"
                    : "bg-zinc-100 border-zinc-300 text-zinc-900 placeholder-zinc-400",
    divider:   dark ? "border-white/5"  : "border-zinc-200",
    rowHover:  dark ? "hover:bg-white/5": "hover:bg-zinc-50",
    navActive: "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20",
    navIdle:   dark ? "text-zinc-500 hover:text-white hover:bg-white/5"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100",
    mobileNav: dark ? "bg-[#050505]/95 border-white/5" : "bg-white/95 border-zinc-200",
  };
}