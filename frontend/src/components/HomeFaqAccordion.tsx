"use client";

import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

interface HomeFaqAccordionProps {
  items: FaqItem[];
}

export function HomeFaqAccordion({ items }: HomeFaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-4">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm transition-all hover:border-gray-300"
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="w-full flex items-center justify-between py-5 px-6 text-left font-bold text-gray-900 text-base cursor-pointer"
              aria-expanded={isOpen}
            >
              <span>{item.q}</span>
              <span className="flex h-6 w-6 items-center justify-center text-gray-400 text-2xl font-light">
                {isOpen ? "−" : "+"}
              </span>
            </button>

            {isOpen && (
              <div className="px-6 pb-5 pt-0 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
