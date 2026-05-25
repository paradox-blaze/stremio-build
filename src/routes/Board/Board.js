// Copyright (C) 2017-2023 Smart code 203358507
const ReactDOM = require('react-dom');
const React = require('react');
const classnames = require('classnames');
const debounce = require('lodash.debounce');
const useTranslate = require('stremio/common/useTranslate');
const { useStreamingServer, useNotifications, withCoreSuspender, getVisibleChildrenRange, useProfile } = require('stremio/common');
const { ContinueWatchingItem, EventModal, MainNavBars, MetaItem, MetaRow } = require('stremio/components');
const useBoard = require('./useBoard');
const useContinueWatchingPreview = require('./useContinueWatchingPreview');
const styles = require('./styles');
const { default: StreamingServerWarning } = require('./StreamingServerWarning');

let userHasInteracted = false;
if (typeof window !== 'undefined') {
    const registerInteraction = () => {
        userHasInteracted = true;
        // Clean up the listeners instantly so it doesn't waste memory
        window.removeEventListener('pointerdown', registerInteraction);
        window.removeEventListener('keydown', registerInteraction);
    };
    // Listens for mouse clicks, trackpad taps, or keyboard presses
    window.addEventListener('pointerdown', registerInteraction, { passive: true });
    window.addEventListener('keydown', registerInteraction, { passive: true });
} 

const THRESHOLD = 5;

const HeroBanner = ({ catalogs }) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [heroItems, setHeroItems] = React.useState([]);
    
    const [isHovered, setIsHovered] = React.useState(false);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [dynamicTrailer, setDynamicTrailer] = React.useState(null);
    
    const getGlobalMute = () => {
        if (typeof userHasInteracted !== 'undefined' && !userHasInteracted) return true;
        const stored = localStorage.getItem('netflix_global_mute');
        return stored !== null ? stored === 'true' : true;
    };
    
    const [isMuted, setIsMuted] = React.useState(getGlobalMute);
    const initialMuteRef = React.useRef(getGlobalMute());
    
    const playTimer = React.useRef(null);
    const iframeRef = React.useRef(null);

    // 1. THE WATCHLY FILTER FIX (No more cache, fresh shuffle every time)
    React.useEffect(() => {
        if (!catalogs || catalogs.length === 0) return;

        let customAddonPool = [];
        let cinemetaPool = [];

        catalogs.forEach(cat => {
            const catItems = cat?.content?.content || cat?.items || [];
            // RELAXED FILTER: We no longer require a background or description! Just a poster.
            const validItems = catItems.filter(i => i.poster && (i.type === 'movie' || i.type === 'series'));
            const isCinemeta = cat.id?.includes('cinemeta') || cat.addon?.manifest?.id?.includes('cinemeta');
            
            if (isCinemeta) cinemetaPool = [...cinemetaPool, ...validItems];
            else customAddonPool = [...customAddonPool, ...validItems];
        });

        const shuffledCustom = customAddonPool.sort(() => 0.5 - Math.random());
        const shuffledCinemeta = cinemetaPool.sort(() => 0.5 - Math.random());
        // Put custom addons (Watchly) at the front of the line!
        let mixedPool = [...shuffledCustom, ...shuffledCinemeta];
        
        const uniqueItems = Array.from(new Map(mixedPool.map(item => [item.id, item])).values());

        if (uniqueItems.length >= 5) {
            setHeroItems(uniqueItems.slice(0, 5));
        } else if (uniqueItems.length > 0) {
            setHeroItems(uniqueItems); 
        }
    }, [catalogs]); 

    React.useEffect(() => {
        if (heroItems.length <= 1 || isHovered) return; 
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % heroItems.length);
        }, 7000); 
        return () => clearInterval(interval);
    }, [heroItems.length, isHovered]);

    const activeItem = heroItems[currentIndex];
    const activeTrailers = activeItem?.trailers || activeItem?.trailerStreams || [];
    const initialTrailerId = activeTrailers.length > 0 ? (activeTrailers[0].ytId || activeTrailers[0].source) : null;

    React.useEffect(() => {
        if (isPlaying && !initialTrailerId && activeItem?.id) {
            let metaUrl = '';
            if (activeItem.id.startsWith('tt')) metaUrl = `https://v3-cinemeta.strem.io/meta/${activeItem.type}/${activeItem.id}.json`;
            else if (activeItem.id.startsWith('tmdb:') || !isNaN(activeItem.id)) {
                const tmdbId = activeItem.id.startsWith('tmdb:') ? activeItem.id : `tmdb:${activeItem.id}`;
                metaUrl = `https://tmdb.strem.fun/meta/${activeItem.type}/${tmdbId}.json`;
            }

            if (metaUrl) {
                fetch(metaUrl).then(res => res.json()).then(data => {
                    const fetchedTrailers = data?.meta?.trailers || data?.meta?.trailerStreams || [];
                    if (fetchedTrailers.length > 0) setDynamicTrailer(fetchedTrailers[0].ytId || fetchedTrailers[0].source);
                }).catch(console.error);
            }
        }
    }, [isPlaying, initialTrailerId, activeItem]);

    const finalTrailerId = initialTrailerId || dynamicTrailer;

    const handleMouseEnter = () => {
        setIsHovered(true); 
        const currentMute = getGlobalMute();
        initialMuteRef.current = currentMute;
        setIsMuted(currentMute);
        playTimer.current = setTimeout(() => { setIsPlaying(true); }, 1500); 
    };

    const handleMouseLeave = () => {
        setIsHovered(false); 
        setIsPlaying(false);
        setDynamicTrailer(null);
        clearTimeout(playTimer.current);
    };

    const toggleMute = (e) => {
        e.preventDefault();
        e.stopPropagation(); 
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const newMuteState = !isMuted;
            const command = isMuted ? 'unMute' : 'mute';
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ "event": "command", "func": command, "args": [] }), "*");
            setIsMuted(newMuteState);
            localStorage.setItem('netflix_global_mute', newMuteState.toString());
        }
    };

    if (heroItems.length === 0) return null;

    return (
        <div 
            className={styles['netflix-hero-container']}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {heroItems.map((item, index) => {
                const detailHref = item.deepLinks?.metaDetails || `#/detail/${item.type}/${item.id}`;
                const isActive = index === currentIndex;
                
                // FALLBACK FIX: If a Watchly item has no background, stretch the poster to fill the banner!
                const displayBg = item.background || item.poster;

                return (
                    <div 
                        key={item.id} 
                        className={classnames(styles['netflix-hero-slide'], { [styles['active']]: isActive })}
                        style={{ backgroundImage: `url(${displayBg})` }}
                    >
                        {isActive && isPlaying && finalTrailerId && (
                            <div className={styles['hero-video-wrapper']}>
                                <iframe 
                                    ref={iframeRef}
                                    src={`https://www.youtube.com/embed/${finalTrailerId}?autoplay=1&controls=0&mute=${initialMuteRef.current ? 1 : 0}&modestbranding=1&loop=1&playlist=${finalTrailerId}&enablejsapi=1&disablekb=1&fs=0&iv_load_policy=3&rel=0&playsinline=1`}
                                    allow="autoplay"
                                    frameBorder="0"
                                    className={styles['hero-video-iframe']}
                                />
                            </div>
                        )}

                        <div className={styles['netflix-hero-vignette']}>
                            <div className={styles['netflix-hero-content']}>
                                {item.logo ? (
                                    <img src={item.logo} alt={item.name} className={styles['netflix-hero-logo']} />
                                ) : (
                                    <h1>{item.name}</h1>
                                )}
                                <div className={styles['netflix-hero-action-row']}>
                                    <a href={detailHref} className={styles['netflix-btn-info']}>
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                            <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                                        </svg>
                                        More Info
                                    </a>
                                    <p className={styles['netflix-hero-description']}>
                                        {item.description || "Explore this title to see more details."}
                                    </p>
                                </div>
                            </div>
                            
                            {isActive && isPlaying && finalTrailerId && (
                                <button className={styles['hero-mute-btn']} onClick={toggleMute}>
                                    {isMuted ? (
                                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// We changed this to accept standard props, not just { item }

const NetflixHoverCard = (props) => {
    const { className, poster, name, description, type, id, deepLinks, trailers, trailerStreams, background, ...rest } = props;

    if (!poster) {
        return <div className={classnames(styles['netflix-card-wrapper'], className)} style={{ backgroundColor: '#141414' }} {...rest} />;
    }

    // Helper to read your global preference (Defaults to true/muted on very first visit)
    const getGlobalMute = () => {
        if (!userHasInteracted) {
            return true; 
        }
        
        // If you HAVE interacted, it is safe to pull your memory
        const stored = localStorage.getItem('netflix_global_mute');
        return stored !== null ? stored === 'true' : true;
    };

    const [isHovered, setIsHovered] = React.useState(false);
    const [dynamicTrailer, setDynamicTrailer] = React.useState(null);
    const [modalPos, setModalPos] = React.useState({ top: 0, left: 0 });
    
    // UI State for the SVG icon
    const [isMuted, setIsMuted] = React.useState(getGlobalMute); 
    // Locked state for the iframe URL so it NEVER reloads mid-video
    const initialMuteRef = React.useRef(getGlobalMute());
    
    const hoverTimer = React.useRef(null);
    const iframeRef = React.useRef(null);
    const cardRef = React.useRef(null);

    const activeTrailers = trailers || trailerStreams || [];
    const initialTrailerId = activeTrailers.length > 0 ? (activeTrailers[0].ytId || activeTrailers[0].source) : null;

    React.useEffect(() => {
        if (isHovered && !initialTrailerId && id) {
            let metaUrl = '';
            if (id.startsWith('tt')) {
                metaUrl = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;
            } else if (id.startsWith('tmdb:') || !isNaN(id)) {
                const tmdbId = id.startsWith('tmdb:') ? id : `tmdb:${id}`;
                metaUrl = `https://tmdb.strem.fun/meta/${type}/${tmdbId}.json`;
            }

            if (metaUrl) {
                fetch(metaUrl)
                    .then(res => res.json())
                    .then(data => {
                        const fetchedTrailers = data?.meta?.trailers || data?.meta?.trailerStreams || [];
                        if (fetchedTrailers.length > 0) {
                            setDynamicTrailer(fetchedTrailers[0].ytId || fetchedTrailers[0].source);
                        }
                    }).catch(console.error);
            }
        }
    }, [isHovered, initialTrailerId, id, type]);

    const finalTrailerId = initialTrailerId || dynamicTrailer;

    const calculatePosition = () => {
        if (!cardRef.current) return { top: 0, left: 0 };
        const rect = cardRef.current.getBoundingClientRect();
        
        let targetLeft = rect.left - 165; 
        let targetTop = rect.top - 80;

        const padding = 25;
        if (targetLeft < padding) targetLeft = padding; 
        if (targetLeft + 450 > window.innerWidth - padding) targetLeft = window.innerWidth - 450 - padding;
        
        return { top: targetTop, left: targetLeft };
    };

    const handleMouseEnter = () => {
        hoverTimer.current = setTimeout(() => {
            // 1. Grab the latest global mute state in case you changed it on another movie!
            const currentMute = getGlobalMute();
            initialMuteRef.current = currentMute; 
            setIsMuted(currentMute); 
            
            setModalPos(calculatePosition());
            setIsHovered(true);
        }, 1100); 
    };

    const handleMouseLeave = () => {
        clearTimeout(hoverTimer.current);
        setIsHovered(false);
        setDynamicTrailer(null);
        // Notice we no longer reset isMuted here! It stays synced with your global preference.
    };

    const toggleMute = (e) => {
        e.preventDefault();
        e.stopPropagation(); 
        
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const newMuteState = !isMuted;
            const command = isMuted ? 'unMute' : 'mute';
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ "event": "command", "func": command, "args": [] }), "*");
            
            // 2. Update the UI icon and save the choice to your browser memory
            setIsMuted(newMuteState);
            localStorage.setItem('netflix_global_mute', newMuteState.toString());
        }
    };

    const detailHref = deepLinks?.metaDetails || `#/detail/${type}/${id}`;

    const hoverModal = isHovered ? ReactDOM.createPortal(
        <div 
            className={styles['hover-modal']} 
            style={{ top: modalPos.top, left: modalPos.left }}
            onMouseLeave={handleMouseLeave}
        >
            <div className={styles['hover-video-container']}>
                {finalTrailerId ? (
                    <>
                        {/* 3. The URL strictly uses initialMuteRef so it never changes mid-play */}
                        <iframe 
                            ref={iframeRef}
                            src={`https://www.youtube.com/embed/${finalTrailerId}?autoplay=1&controls=0&mute=${initialMuteRef.current ? 1 : 0}&modestbranding=1&loop=1&playlist=${finalTrailerId}&enablejsapi=1&disablekb=1&fs=0&iv_load_policy=3&rel=0&playsinline=1`}
                            allow="autoplay"
                            frameBorder="0"
                            className={styles['hover-video']}
                        />
                        <button className={styles['hover-mute-btn']} onClick={toggleMute}>
                            {isMuted ? (
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                            )}
                        </button>
                    </>
                ) : (
                    <img src={background || poster} className={styles['hover-video-fallback']} />
                )}
            </div>
            
            <div className={styles['hover-info']}>
                <h4>{name}</h4>
                <p className={styles['hover-desc']}>{description || "Explore this title to see more details."}</p>
                <a href={detailHref} className={styles['hover-play-btn']}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style={{marginRight: '6px'}}><path d="M8 5v14l11-7z"/></svg>
                    Play Now
                </a>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div 
            ref={cardRef} 
            className={classnames(styles['netflix-card-wrapper'], className)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            {...rest} 
        >
            <a href={detailHref} style={{ display: 'block', width: '100%', height: '100%' }}>
                <img src={poster} alt={name} className={styles['standard-poster']} loading="lazy" />
            </a>
            {hoverModal}
        </div>
    );
};

const Board = () => {
    const t = useTranslate();
    const streamingServer = useStreamingServer();
    const continueWatchingPreview = useContinueWatchingPreview();
    const [board, loadBoardRows] = useBoard();
    const notifications = useNotifications();
    const profile = useProfile();
    const boardCatalogsOffset = continueWatchingPreview.items.length > 0 ? 1 : 0;
    const scrollContainerRef = React.useRef();
    const showStreamingServerWarning = React.useMemo(() => {
        return streamingServer.settings !== null && streamingServer.settings.type === 'Err' && (
            isNaN(profile.settings.streamingServerWarningDismissed.getTime()) ||
            profile.settings.streamingServerWarningDismissed.getTime() < Date.now());
    }, [profile.settings, streamingServer.settings]);
    const onVisibleRangeChange = React.useCallback(() => {
        const range = getVisibleChildrenRange(scrollContainerRef.current);
        if (range === null) {
            return;
        }

        const start = Math.max(0, range.start - boardCatalogsOffset - THRESHOLD);
        const end = range.end - boardCatalogsOffset + THRESHOLD;
        if (end < start) {
            return;
        }

        loadBoardRows({ start, end });
    }, [boardCatalogsOffset]);
    const onScroll = React.useCallback(debounce(onVisibleRangeChange, 250), [onVisibleRangeChange]);
    React.useLayoutEffect(() => {
        onVisibleRangeChange();
    }, [board.catalogs, onVisibleRangeChange]);
    return (
        <div className={styles['board-container']}>
            <EventModal />
            <MainNavBars className={styles['board-content-container']} route={'board'}>
                <div ref={scrollContainerRef} className={styles['board-content']} onScroll={onScroll}>
                    <HeroBanner catalogs={board.catalogs} scrollContainerRef={scrollContainerRef}/>
                    {
        continueWatchingPreview.items.length > 0 ?
            <MetaRow
                className={classnames(styles['board-row'], styles['continue-watching-row'], 'animation-fade-in')}
                title={t.string('BOARD_CONTINUE_WATCHING')}
                catalog={continueWatchingPreview}
                /* THIS FLAG ENSURES THE 'X' BUTTON APPEARS ONLY HERE */
                itemComponent={(props) => <MetaItem {...props} isCWRow={true} />} 
                notifications={notifications}
            />
            :
            null
                    }
                    {board.catalogs.map((catalog, index) => {
                        switch (catalog.content?.type) {
                            case 'Ready': {
                                return (
                                    <MetaRow
                                        key={index}
                                        className={classnames(styles['board-row'], styles[`board-row-${catalog.content.content[0].posterShape}`], 'animation-fade-in')}
                                        catalog={catalog}
                                        itemComponent={MetaItem}
                                    />
                                );
                            }
                            case 'Err': {
                                if (catalog.content.content !== 'EmptyContent') {
                                    return (
                                        <MetaRow
                                            key={index}
                                            className={classnames(styles['board-row'], 'animation-fade-in')}
                                            catalog={catalog}
                                            message={catalog.content.content}
                                        />
                                    );
                                }
                                return null;
                            }
                            default: {
                                return (
                                    <MetaRow.Placeholder
                                        key={index}
                                        className={classnames(styles['board-row'], styles['board-row-poster'], 'animation-fade-in')}
                                        catalog={catalog}
                                        title={t.catalogTitle(catalog)}
                                    />
                                );
                            }
                        }
                    })}
                </div>
            </MainNavBars>
            {
                showStreamingServerWarning ?
                    <StreamingServerWarning className={styles['board-warning-container']} />
                    :
                    null
            }
        </div>
    );
};

const BoardFallback = () => (
    <div className={styles['board-container']}>
        <MainNavBars className={styles['board-content-container']} route={'board'} />
    </div>
);

module.exports = withCoreSuspender(Board, BoardFallback);
