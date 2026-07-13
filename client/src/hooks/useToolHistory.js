// client/src/hooks/useToolHistory.js
// Shared 30-day auto-pruning history hook for all FIC tools

import { useState, useEffect, useCallback } from 'react';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @param {string} storageKey - localStorage key (e.g. 'fic_video_history')
 * @param {number} [maxItems=50] - max items to keep per tool
 * @returns {{ history, addToHistory, deleteFromHistory, clearHistory, showPanel, setShowPanel }}
 */
export function useToolHistory(storageKey, maxItems = 50) {
  const [history, setHistory] = useState([]);
  const [showPanel, setShowPanel] = useState(false);

  // Load + prune on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const now = Date.now();
      const pruned = parsed.filter(
        (item) => item.createdAt && now - item.createdAt < THIRTY_DAYS_MS
      );
      setHistory(pruned);
      // Persist pruned list back
      if (pruned.length !== parsed.length) {
        localStorage.setItem(storageKey, JSON.stringify(pruned));
      }
    } catch (_) {}
  }, [storageKey]);

  /** Save a new item. Item must include { id, title, createdAt, ... } */
  const addToHistory = useCallback((item) => {
    setHistory((prev) => {
      const deduped = prev.filter((h) => h.id !== item.id);
      const updated = [item, ...deduped].slice(0, maxItems);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (_) {
        // If quota exceeded, drop oldest items
        const trimmed = updated.slice(0, Math.floor(maxItems / 2));
        try { localStorage.setItem(storageKey, JSON.stringify(trimmed)); } catch (__) {}
        return trimmed;
      }
      return updated;
    });
  }, [storageKey, maxItems]);

  /** Remove a single item by id */
  const deleteFromHistory = useCallback((id) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.id !== id);
      try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
  }, [storageKey]);

  /** Wipe all history */
  const clearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.removeItem(storageKey); } catch (_) {}
  }, [storageKey]);

  return { history, addToHistory, deleteFromHistory, clearHistory, showPanel, setShowPanel };
}

/** Returns a human-readable relative time string ("2 days ago", "Just now", etc.) */
export function timeAgo(ms) {
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return 'Long ago';
}
