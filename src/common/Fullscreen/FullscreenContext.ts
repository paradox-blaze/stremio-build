// Copyright (C) 2017-2026 Smart code 203358507

import { createContext } from 'react';

export type FullscreenContextValue = readonly [
    boolean,
    () => Promise<void> | void,
    () => void,
    () => void,
];

const noop = () => undefined;

const defaultValue: FullscreenContextValue = [false, noop, noop, noop];

const FullscreenContext = createContext<FullscreenContextValue>(defaultValue);

FullscreenContext.displayName = 'FullscreenContext';

export default FullscreenContext;
