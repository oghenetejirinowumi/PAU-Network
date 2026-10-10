"use client";

import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EMOJI_PICKER } from "@/lib/format";

/** A small emoji button that inserts into the parent's text. */
export function EmojiPicker({ onPick, align = "left" }: { onPick: (emoji: string) => void; align?: "left" | "right" }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setIsOpen((value) => !value)} className="rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-accent" aria-label="Add emoji">
        <Smile className="size-5" />
      </button>
      {isOpen && (
        <div className={`absolute bottom-10 z-40 grid w-64 grid-cols-6 gap-1 rounded-card border border-line bg-surface p-2 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          {EMOJI_PICKER.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onPick(emoji);
                setIsOpen(false);
              }}
              className="rounded-md p-1 text-xl hover:bg-surface-muted"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
