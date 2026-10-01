import Fuse from "fuse.js";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Track } from "../types";

import { cn } from "../lib/cn";

interface SongPickerProps {
  pool: Track[];
  onPick: (track: Track) => void;
}

const MAX_RESULTS = 8;

export function SongPicker({ pool, onPick }: SongPickerProps) {
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const fuse = useMemo(
    () =>
      new Fuse(pool, {
        keys: ["name", "artists"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [pool],
  );

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return fuse
      .search(trimmed)
      .slice(0, MAX_RESULTS)
      .map((r) => r.item);
  }, [fuse, query]);

  // The highlighted result (index is kept in bounds by the arrow handlers).
  const highlighted = results[highlightIndex];

  // Keep the arrow-highlighted item visible in the scrollable list.
  useEffect(() => {
    listRef.current
      ?.querySelector("[data-highlighted='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, results]);

  const handlePick = (track: Track) => {
    onPick(track);
    setQuery("");
    setHighlightIndex(0);
    inputRef.current?.focus();
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    // New results start with the top item highlighted; arrows/hover move it.
    setHighlightIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) setHighlightIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setHighlightIndex((i) => (i - 1 + results.length) % results.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted) handlePick(highlighted);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-neutral-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder="Search for the song..."
          autoFocus
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="song-results"
          aria-activedescendant={highlighted ? `song-option-${highlighted.id}` : undefined}
          aria-autocomplete="list"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 py-4 pr-4 pl-12 text-lg text-white placeholder-neutral-500 transition-colors outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
      </div>

      {results.length > 0 && (
        <ul
          ref={listRef}
          id="song-results"
          role="listbox"
          className="absolute inset-x-0 z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl"
        >
          {results.map((track, i) => (
            <li
              key={track.id}
              id={`song-option-${track.id}`}
              role="option"
              aria-selected={i === highlightIndex}
              data-highlighted={i === highlightIndex}
            >
              <button
                type="button"
                onClick={() => handlePick(track)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  i === highlightIndex ? "bg-neutral-800" : "hover:bg-neutral-800/60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{track.name}</p>
                  <p className="truncate text-sm text-neutral-500">{track.artists}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
