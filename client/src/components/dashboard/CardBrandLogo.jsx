import React from "react";

// Small inline-SVG brand marks for the four supported card types.
// Each renders at 32x20 by default so they line up nicely in a table cell.
// We render simplified, recognizable marks rather than the full trademarked
// logos; that's the same pattern most dashboards use for compact listings.

const BOX = "w-8 h-5 rounded-[3px] shrink-0";

function Visa() {
  return (
    <span
      className={`${BOX} bg-[#1A1F71] flex items-center justify-center`}
      aria-label="Visa"
    >
      <span className="text-[9px] font-extrabold tracking-[0.5px] text-white italic leading-none">
        VISA
      </span>
    </span>
  );
}

function MasterCard() {
  return (
    <span
      className={`${BOX} bg-white border border-gray-200 flex items-center justify-center gap-[1px]`}
      aria-label="MasterCard"
    >
      <span className="w-3 h-3 rounded-full bg-[#EB001B] -mr-1.5" />
      <span className="w-3 h-3 rounded-full bg-[#F79E1B] mix-blend-multiply" />
    </span>
  );
}

function Amex() {
  return (
    <span
      className={`${BOX} bg-[#006FCF] flex items-center justify-center`}
      aria-label="American Express"
    >
      <span className="text-[8px] font-extrabold tracking-[0.4px] text-white leading-none">
        AMEX
      </span>
    </span>
  );
}

function Discover() {
  return (
    <span
      className={`${BOX} bg-white border border-gray-200 flex items-center justify-center relative overflow-hidden`}
      aria-label="Discover"
    >
      <span className="text-[7px] font-extrabold tracking-[0.2px] text-gray-900 leading-none">
        DISCOVER
      </span>
      <span className="absolute right-0.5 w-1.5 h-1.5 rounded-full bg-[#FF6000]" />
    </span>
  );
}

function Unknown() {
  return (
    <span
      className={`${BOX} bg-gray-100 border border-gray-200 flex items-center justify-center`}
      aria-label="Unknown card"
    >
      <span className="text-[9px] font-medium text-gray-400 leading-none">?</span>
    </span>
  );
}

export default function CardBrandLogo({ type }) {
  switch (type) {
    case "Visa":
      return <Visa />;
    case "MasterCard":
      return <MasterCard />;
    case "Amex":
      return <Amex />;
    case "Discover":
      return <Discover />;
    default:
      return <Unknown />;
  }
}
