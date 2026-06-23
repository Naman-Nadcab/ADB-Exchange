'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SidebarContextValue {
  /** Desktop (lg+) rail collapse state. */
  collapsed: boolean;
  toggle: () => void;
  /** Mobile (<lg) off-canvas drawer state. */
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

const SidebarCtx = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
  toggleMobile: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((o) => !o), []);
  return (
    <SidebarCtx.Provider value={{ collapsed, toggle, mobileOpen, openMobile, closeMobile, toggleMobile }}>
      {children}
    </SidebarCtx.Provider>
  );
}

export function useSidebarState() {
  return useContext(SidebarCtx);
}
