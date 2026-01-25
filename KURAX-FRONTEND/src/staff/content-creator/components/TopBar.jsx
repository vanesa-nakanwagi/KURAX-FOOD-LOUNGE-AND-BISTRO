
import { Bell, Search, ChevronDown } from "lucide-react";

export default function TopBar({ staffName = "Content Manager" }) {
  return (
    <div className="h-20 bg-zinc-950 font-[Outfit] border-b border-slate-800 px-20 flex items-center justify-between sticky top-5 z-30">

      {/* Right section */}
      <div className="flex items-center justify-end gap-6">
        {/* Search Bar */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 hover:border-slate-700 transition-colors">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search menus, events..."
            className="bg-transparent outline-none text-sm text-slate-200 placeholder-slate-500 w-40"
          />
        </div>


       
      </div>
    </div>
  );
}
