// Copyright (C) 2017-2026 Smart code 203358507

import { createContext } from 'react';

const GamepadContext = createContext<{
    on: (event: string, id: string, callback: (data?: any) => void) => void;
    off: (event: string, id: string) => void;
} | null>(null);

export default GamepadContext;
