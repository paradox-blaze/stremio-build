// Copyright (C) 2017-2026 Smart code 203358507

import React, { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useToast from 'stremio/common/Toast/useToast';
import GamepadContext from './GamepadContext';

type GamepadEventHandlers = Map<string, Map<string, (data?: any) => void>>;

const GamepadProvider: React.FC<{
    enabled: boolean;
    onGuide?: () => void;
    children: React.ReactNode;
}> = ({ enabled, onGuide, children }) => {
    const { t } = useTranslation();
    const toast = useToast();
    const connectedGamepads = useRef<number>(0);
    const lastButtonState = useRef<number[]>([]);
    const lastButtonPressedTime = useRef<number>(0);
    const axisTimer = useRef<number>(0);
    const eventHandlers = useRef<GamepadEventHandlers>(new Map());

    const on = useCallback((event: string, id: string, callback: (data?: any) => void) => {
        if (!eventHandlers.current.has(event)) {
            eventHandlers.current.set(event, new Map());
        }

        const handlers = eventHandlers.current.get(event)!;

        // Ensure only one handler per component
        handlers.set(id, callback);
    }, []);

    const off = useCallback((event: string, id: string) => {
        const handlersMap = eventHandlers.current.get(event);
        handlersMap?.delete(id);
        if (handlersMap?.size === 0) {
            eventHandlers.current.delete(event);
        }
    }, []);

    const emit = (event: string, data?: any) => {
        if (eventHandlers.current.has(event)) {
            const handlersMap = eventHandlers.current.get(event)!;

            if (!handlersMap || handlersMap.size === 0) return;

            const latestHandler = Array.from(handlersMap.values()).slice(-1)[0];
            if (latestHandler) {
                latestHandler(data);
            }
        }
    };

    const onGamepadConnected = () => {
        // @ts-expect-error show() expects no arguments
        toast.show({
            type: 'info',
            title: t('GAMEPAD_CONNECTED'),
            timeout: 4000,
        });
    };

    const onGamepadDisconnected = () => {
        // @ts-expect-error show() expects no arguments
        toast.show({
            type: 'info',
            title: t('GAMEPAD_DISCONNECTED'),
            timeout: 4000,
        });
    };

    useEffect(() => {
        if (enabled) {
            window.addEventListener('gamepadconnected', onGamepadConnected);
            window.addEventListener('gamepaddisconnected', onGamepadDisconnected);
        }

        return () => {
            if (enabled) {
                window.removeEventListener('gamepadconnected', onGamepadConnected);
                window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
            }
        };
    }, [enabled]);

    useEffect(() => {
        if (onGuide) {
            on('buttonX', 'gamepad-guide', onGuide);
        }
        return () => {
            off('buttonX', 'gamepad-guide');
        };
    }, [onGuide]);

    useEffect(() => {
        if (!enabled || typeof navigator.getGamepads !== 'function') return;

        let animationFrameId: number;

        const updateStatus = () => {
            if (document.hasFocus()) {
                const currentTime = Date.now();
                const controllers = Array.from(navigator.getGamepads()).filter(
                    (gp) => gp !== null
                ) as Gamepad[];

                connectedGamepads.current = controllers.length;

                controllers.forEach((controller, index) => {
                    const buttonsState = controller.buttons.reduce(
                        (buttons, button, i) => buttons | (button.pressed ? 1 << i : 0),
                        0
                    );

                    const processButton =
                        currentTime - lastButtonPressedTime.current > 250;
                    if (
                        lastButtonState.current[index] !== buttonsState ||
                        processButton
                    ) {
                        lastButtonPressedTime.current = currentTime;
                        lastButtonState.current[index] = buttonsState;

                        if (buttonsState & (1 << 0)) emit('buttonA');
                        if (buttonsState & (1 << 1)) emit('buttonB');
                        if (buttonsState & (1 << 2)) emit('buttonX');
                        if (buttonsState & (1 << 3)) emit('buttonY');
                        if (buttonsState & (1 << 4)) emit('buttonLT');
                        if (buttonsState & (1 << 5)) emit('buttonRT');
                    }

                    const deadZone = 0.05;
                    const maxSpeed = 100;
                    let axisHandled = false;

                    if (controller.axes[0] < -deadZone) {
                        if (
                            currentTime - axisTimer.current >
                            maxSpeed + (2000 - Math.abs(controller.axes[0]) * 2000)
                        ) {
                            emit('analog', 'left');
                            axisHandled = true;
                        }
                    }
                    if (controller.axes[0] > deadZone) {
                        if (
                            currentTime - axisTimer.current >
                            maxSpeed + (2000 - Math.abs(controller.axes[0]) * 2000)
                        ) {
                            emit('analog', 'right');
                            axisHandled = true;
                        }
                    }
                    if (controller.axes[1] < -deadZone) {
                        if (
                            currentTime - axisTimer.current >
                            maxSpeed + (2000 - Math.abs(controller.axes[1]) * 2000)
                        ) {
                            emit('analog', 'up');
                            axisHandled = true;
                        }
                    }
                    if (controller.axes[1] > deadZone) {
                        if (
                            currentTime - axisTimer.current >
                            maxSpeed + (2000 - Math.abs(controller.axes[1]) * 2000)
                        ) {
                            emit('analog', 'down');
                            axisHandled = true;
                        }
                    }

                    if (axisHandled) axisTimer.current = currentTime;
                });
            }
            animationFrameId = requestAnimationFrame(updateStatus);
        };

        animationFrameId = requestAnimationFrame(updateStatus);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [enabled]);

    return (
        <GamepadContext.Provider value={{ on, off }}>
            {children}
        </GamepadContext.Provider>
    );
};

export default GamepadProvider;
