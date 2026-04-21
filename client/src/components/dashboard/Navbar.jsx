import React from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import logoUrl from "../../assets/signapay-logo.webp";

export default function Navbar({ username }) {
  const { signOut } = useAuth();

  return (
    <nav className="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-10">
        <img
          src={logoUrl}
          alt="Signapay"
          className="h-8 w-auto select-none"
          draggable={false}
        />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-800 capitalize">{username}</p>
            <p className="text-xs text-gray-500 font-normal">Administrator</p>
          </div>
          <button
            onClick={signOut}
            className="w-10 h-10 bg-gray-50 flex items-center justify-center rounded-full text-gray-600 hover:bg-red-50 hover:text-red-500 transition-all"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
