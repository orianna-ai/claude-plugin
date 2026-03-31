import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/vanilla/utils";

import { currentIdentity } from "../identity.ts";

import { getDesignId } from "./getDesignId.tsx";

type Scope = "global" | "design" | "user";

function resolveKey(name: string, scope: Scope): string {
  switch (scope) {
    case "global":
      return `sb:${name}`;
    case "design":
      return `sb:${name}:${getDesignId() ?? "unknown"}`;
    case "user":
      return `sb:${name}:${currentIdentity?.email ?? "anon"}`;
  }
}

export function createAtom<T>({
  initialValue,
  name,
  scope,
}: {
  initialValue: T;
  name: string;
  scope: Scope;
}) {
  const storage = createJSONStorage<T>(() => ({
    getItem(key: string): string | null {
      const resolvedKey = resolveKey(key, scope);
      return localStorage.getItem(resolvedKey);
    },
    setItem(key: string, value: string): void {
      const resolvedKey = resolveKey(key, scope);
      localStorage.setItem(resolvedKey, value);
    },
    removeItem(key: string): void {
      const resolvedKey = resolveKey(key, scope);
      localStorage.removeItem(resolvedKey);
    },
  }));

  const base = atomWithStorage<T>(name, initialValue, storage, {
    getOnInit: true,
  });

  return atom<T, [update: (t: T) => T], Promise<void>>(
    (get) => get(base),
    async (get, set, update) => {
      const prev = get(base);
      const next = update(prev);
      set(base, next);
    },
  );
}
