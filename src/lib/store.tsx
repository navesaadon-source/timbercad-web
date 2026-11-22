import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { CatalogItem, Profile } from "./types";

interface Ctx {
  me: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  catalog: CatalogItem[];
  reloadCatalog: () => Promise<void>;
  label: (category: string, key?: string) => string;
  options: (category: string, parent?: string) => CatalogItem[];
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const refresh = useCallback(async () => {
    try { setMe(await api.me()); } catch { setMe(null); } finally { setLoading(false); }
  }, []);
  const reloadCatalog = useCallback(async () => { try { setCatalog(await api.catalog()); } catch { /* offline */ } }, []);
  useEffect(() => { refresh(); reloadCatalog(); return api.onAuthChange(() => refresh()); }, [refresh, reloadCatalog]);

  const value = useMemo<Ctx>(() => ({
    me, loading, refresh, catalog, reloadCatalog,
    label: (category, key) => (key ? catalog.find((c) => c.category === category && c.key === key)?.label ?? key : ""),
    options: (category, parent) =>
      catalog.filter((c) => c.category === category && c.active && (parent === undefined || c.parent === parent)).sort((a, b) => a.sort - b.sort),
  }), [me, loading, refresh, catalog, reloadCatalog]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fn().then((d) => live && (setData(d), setError(""))).catch((e) => live && setError(e?.message ?? String(e)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((t) => t + 1), setData };
}
