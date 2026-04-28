// Copyright (C) 2017-2026 Smart code 203358507

import { useEffect } from 'react';
import { useGamepad } from '../GamepadContext';

const useContentGamepadNavigation = (
    sectionRef: React.RefObject<HTMLDivElement>,
    gamepadHandlerId: string
) => {
    const gamepad = useGamepad();

    useEffect(() => {
        const handleGamepadNavigation = (
            direction: 'left' | 'right' | 'up' | 'down'
        ) => {
            const elements = Array.from(
                sectionRef.current?.querySelectorAll<HTMLDivElement>('[tabindex="0"]') || []
            );
            if (elements.length === 0) return;

            const activeElement = sectionRef.current?.querySelector<HTMLDivElement>(':focus');

            if (!activeElement) {
                elements[0].focus();
                return;
            }

            let closestElement: HTMLDivElement | null = null;

            const currentRect = activeElement.getBoundingClientRect();

            let closestDistance = Infinity;

            elements.forEach((el) => {
                if (el === activeElement) return;
                const rect = el.getBoundingClientRect();

                let distance = Infinity;

                switch (direction) {
                    case 'left':
                        if (
                            rect.right <= currentRect.left &&
                            (rect.top === currentRect.top ||
                                (rect.top < currentRect.top && rect.bottom > currentRect.top)
                            )
                        ) {
                            distance = currentRect.left - rect.right;
                        }
                        break;
                    case 'right':
                        if (
                            currentRect.right <= rect.left &&
                            (rect.top === currentRect.top ||
                                (rect.top < currentRect.top && rect.bottom > currentRect.top)
                            )
                        ) {
                            distance = rect.left - currentRect.right;
                        }
                        break;
                    case 'up':
                        if (
                            rect.bottom <= currentRect.top &&
                            (rect.left === currentRect.left ||
                                (rect.left < currentRect.left && rect.right > currentRect.left)
                            )
                        ) {
                            distance = currentRect.top - rect.bottom;
                        }
                        break;
                    case 'down':
                        if (
                            rect.top >= currentRect.bottom &&
                            (rect.left === currentRect.left ||
                                (rect.left < currentRect.left && rect.right > currentRect.left)
                            )
                        ) {
                            distance = rect.top - currentRect.bottom;
                        }
                        break;
                }

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestElement = el;
                }
            });

            if (closestElement) {
                closestElement.focus();
            }
        };

        const onSelect = () => {
            const elements = Array.from(
                sectionRef.current?.querySelectorAll<HTMLDivElement>('[tabindex="0"]') || []
            );
            if (elements.length === 0) return;

            const activeElement = sectionRef.current?.querySelector<HTMLDivElement>(':focus');

            if (!activeElement) {
                elements[0].focus();
                return;
            }
            const isActiveSelectElement = [activeElement.classList].some((className) => /^select-input/.test(className.toString()));
            if (!isActiveSelectElement) {
                activeElement?.click();
            }
        };

        gamepad?.on('analog', gamepadHandlerId, handleGamepadNavigation);
        gamepad?.on('buttonA', gamepadHandlerId, onSelect);

        return () => {
            gamepad?.off('analog', gamepadHandlerId);
            gamepad?.off('buttonA', gamepadHandlerId);
        };
    }, [gamepad, gamepadHandlerId, sectionRef]);
};

export default useContentGamepadNavigation;
