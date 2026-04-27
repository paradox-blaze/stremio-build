// Copyright (C) 2017-2023 Smart code 203358507

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// @ts-expect-error JS module without types
import { useServices } from 'stremio/services';
import useShell, { type WindowVisibility } from '../useShell';
import FullscreenContext, { type FullscreenContextValue } from './FullscreenContext';

type Props = {
    children: React.ReactNode,
};

// Single source of truth for fullscreen state. Mounted once at the app root so
// the value survives route remounts (fixes desync where switching tabs while in
// fullscreen would leave the UI thinking we were still windowed).
//
// We deliberately avoid useSettings()/useProfile() here because those go
// through useModelState -> useCoreSuspender, which is only available beneath
// the router's withCoreSuspender boundary. This provider sits above the
// router (alongside ToastProvider et al.), so we read the single setting we
// need (escExitFullscreen) directly from core.transport, which is provided
// by ServicesProvider higher up the tree.
const FullscreenProvider = ({ children }: Props) => {
    const shell = useShell();
    const { core } = useServices();

    const [fullscreen, setFullscreen] = useState<boolean>(() => {
        if (typeof document === 'undefined') return false;
        return document.fullscreenElement === document.documentElement;
    });

    const escExitFullscreenRef = useRef<boolean>(false);

    const requestFullscreen = useCallback(async () => {
        if (shell.active) {
            shell.send('win-set-visibility', { fullscreen: true });
        } else {
            try {
                await document.documentElement.requestFullscreen();
            } catch (err) {
                console.error('Error enabling fullscreen', err);
            }
        }
    }, [shell]);

    const exitFullscreen = useCallback(() => {
        if (shell.active) {
            shell.send('win-set-visibility', { fullscreen: false });
        } else {
            if (document.fullscreenElement === document.documentElement) {
                document.exitFullscreen();
            }
        }
    }, [shell]);

    const toggleFullscreen = useCallback(() => {
        fullscreen ? exitFullscreen() : requestFullscreen();
    }, [fullscreen, exitFullscreen, requestFullscreen]);

    useEffect(() => {
        if (!core?.active) return;

        let cancelled = false;
        const refreshSettings = async () => {
            try {
                const ctx = await core.transport.getState('ctx');
                if (!cancelled) {
                    escExitFullscreenRef.current = !!ctx?.profile?.settings?.escExitFullscreen;
                }
            } catch (err) {
                console.error('FullscreenProvider: failed to read ctx state', err);
            }
        };

        const onNewState = (models: string[]) => {
            if (Array.isArray(models) && models.indexOf('ctx') !== -1) {
                refreshSettings();
            }
        };

        refreshSettings();
        core.transport.on('NewState', onNewState);

        return () => {
            cancelled = true;
            core.transport.off('NewState', onNewState);
        };
    }, [core]);

    useEffect(() => {
        const onWindowVisibilityChanged = (state: WindowVisibility) => {
            setFullscreen(state.isFullscreen === true);
        };

        const onFullscreenChange = () => {
            setFullscreen(document.fullscreenElement === document.documentElement);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            const activeElement = document.activeElement as HTMLElement;

            const inputFocused =
                activeElement &&
                (activeElement.tagName === 'INPUT' ||
                 activeElement.tagName === 'TEXTAREA' ||
                 activeElement.tagName === 'SELECT' ||
                 activeElement.isContentEditable);

            if (event.code === 'Escape' && escExitFullscreenRef.current) {
                exitFullscreen();
            }

            if (event.code === 'KeyF' && !inputFocused) {
                toggleFullscreen();
            }

            if (event.code === 'F11' && shell.active) {
                toggleFullscreen();
            }
        };

        shell.on('win-visibility-changed', onWindowVisibilityChanged);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('fullscreenchange', onFullscreenChange);

        return () => {
            shell.off('win-visibility-changed', onWindowVisibilityChanged);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
        };
    }, [shell, toggleFullscreen, exitFullscreen]);

    const value = useMemo<FullscreenContextValue>(
        () => [fullscreen, requestFullscreen, exitFullscreen, toggleFullscreen],
        [fullscreen, requestFullscreen, exitFullscreen, toggleFullscreen]
    );

    return (
        <FullscreenContext.Provider value={value}>
            {children}
        </FullscreenContext.Provider>
    );
};

export default FullscreenProvider;
