'use client';

import { createContext, useContext, ReactNode } from 'react';

const RustRendererContext = createContext(false);

export const RustRendererProvider = ({ value, children }: { value: boolean; children: ReactNode }) => (
  <RustRendererContext value={value}>{children}</RustRendererContext>
);

export const useRustRenderer = () => useContext(RustRendererContext);
