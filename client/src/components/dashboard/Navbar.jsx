import React from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import logoUrl from "../../assets/signapay-logo.webp";
import ThemeToggle from "./ThemeToggle";

export default function Navbar({ username }) {
  const { signOut } = useAuth();

  return (
    <nav className="h-20 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-8 flex items-center justify-between sticky top-0 z-50 transition-colors">
      <div className="flex items-center gap-10">
        <img
          src={logoUrl}
          alt="Signapay"
          // Logo file has dark-gray "SIGNA" + blue "PAY" on transparent.
          // `invert + hue-rotate-180` flips the gray to light (readable on
          // dark chrome) while leaving the blue "PAY" visually intact — blue
          // gets inverted to orange and rotated back to blue.
          className="h-8 w-auto select-none dark:invert dark:hue-rotate-180"
          draggable={false}
        />
      </div>

      <div className="flex items-center gap-5">
        <ThemeToggle />

        <span className="hidden sm:block h-8 w-px bg-gray-100 dark:bg-gray-800" />

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 capitalize">
              {username}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
              Administrator
            </p>
          </div>
          <button
            onClick={signOut}
            className="w-10 h-10 bg-gray-50 dark:bg-gray-800 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 transition-all"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
