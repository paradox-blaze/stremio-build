const React = require('react');
const ReactDOM = require('react-dom');
const classnames = require('classnames');
const { useCore } = require('stremio/core');
const styles = require('./styles'); 

let userHasInteracted = false;
if (typeof window !== 'undefined') {
    const registerInteraction = () => {
        userHasInteracted = true;
        window.removeEventListener('pointerdown', registerInteraction);
        window.removeEventListener('keydown', registerInteraction);
    };
    window.addEventListener('pointerdown', registerInteraction, { passive: true });
    window.addEventListener('keydown', registerInteraction, { passive: true });
}

const MetaItem = (props) => {
    const core = useCore(); 
    const { className, item, meta, isCWRow, ...domProps } = props; 
    const payload = item || meta || props; 
    const { poster, name, description, type, deepLinks, trailers, trailerStreams, background, posterShape } = payload;

    const rawId = payload.id || payload._id || payload.imdb_id || payload.tmdb_id;
    let baseId = rawId ? String(rawId) : '';
    let safeId = baseId;
    if (safeId && !safeId.startsWith('tt') && !safeId.startsWith('tmdb:') && !isNaN(Number(safeId))) {
        safeId = `tmdb:${safeId}`; 
    }

    let coreLink = deepLinks?.metaDetails;
    if (typeof coreLink === 'string' && coreLink.includes('undefined')) coreLink = null;
    const detailHref = coreLink || (safeId ? `#/detail/${type || 'movie'}/${safeId}` : '#');

    // --- DECOUPLED OPTIMISTIC STATE ---
    // We lock the state locally so it never "reverts" a millisecond after you click it.
    const [localLibrary, setLocalLibrary] = React.useState(() => {
        const stored = localStorage.getItem(`stremio_lib_${safeId}`);
        if (stored !== null) return stored === 'true';
        return payload.inLibrary === true || !!payload.state || !!payload._id;
    });

    const [localWatched, setLocalWatched] = React.useState(() => {
        const stored = localStorage.getItem(`stremio_watched_${safeId}`);
        if (stored !== null) return stored === 'true';
        return payload.watched || (payload.state && payload.state.isWatched) || (payload.state && payload.state.watched) || false;
    });

    const [localRating, setLocalRating] = React.useState(() => {
        const stored = localStorage.getItem(`stremio_rating_${safeId}`);
        return stored !== null ? stored : (payload.like || 'none');
    });

    const isContinueWatching = isCWRow === true;

    if (!poster) {
        return <div className={classnames('meta-item', styles['netflix-card-wrapper'], className)} style={{ backgroundColor: '#141414' }} {...domProps} />;
    }

    const getGlobalMute = () => {
        if (!userHasInteracted) return true; 
        const stored = localStorage.getItem('netflix_global_mute');
        return stored !== null ? stored === 'true' : true;
    };

    const [isHovered, setIsHovered] = React.useState(false);
    const [dynamicTrailer, setDynamicTrailer] = React.useState(null);
    const [extendedMeta, setExtendedMeta] = React.useState(null); 
    const [modalPos, setModalPos] = React.useState({ top: 0, left: 0 });
    const [isMuted, setIsMuted] = React.useState(getGlobalMute); 
    const initialMuteRef = React.useRef(getGlobalMute());
    
    const hoverTimer = React.useRef(null);
    const iframeRef = React.useRef(null);
    const cardRef = React.useRef(null);

    const activeTrailers = trailers || trailerStreams || [];
    const initialTrailerId = activeTrailers.length > 0 ? (activeTrailers[0].ytId || activeTrailers[0].source) : null;

    React.useEffect(() => {
        if (isHovered && safeId && !extendedMeta) {
            let metaUrl = '';
            if (safeId.startsWith('tt')) metaUrl = `https://v3-cinemeta.strem.io/meta/${type}/${safeId}.json`;
            else if (safeId.startsWith('tmdb:')) metaUrl = `https://tmdb.strem.fun/meta/${type}/${safeId}.json`;

            if (metaUrl) {
                fetch(metaUrl).then(res => res.json()).then(data => {
                    if (data?.meta) {
                        setExtendedMeta(data.meta); 
                        const fetchedTrailers = data.meta.trailers || data.meta.trailerStreams || [];
                        if (fetchedTrailers.length > 0) setDynamicTrailer(fetchedTrailers[0].ytId || fetchedTrailers[0].source);
                    }
                }).catch(e => console.error("Dynamic fetch failed:", e));
            }
        }
    }, [isHovered, safeId, type, extendedMeta]);

    const finalTrailerId = initialTrailerId || dynamicTrailer;
    const displayDesc = description || extendedMeta?.description || "Explore this title to see more details.";
    const displayBg = background || extendedMeta?.background || poster;

    const calculatePosition = () => {
        if (!cardRef.current) return { top: 0, left: 0 };
        const rect = cardRef.current.getBoundingClientRect();
        let targetLeft = rect.left - ((450 - rect.width) / 2); 
        let targetTop = rect.top - 50; 
        const padding = 25;
        if (targetLeft < padding) targetLeft = padding; 
        if (targetLeft + 450 > window.innerWidth - padding) targetLeft = window.innerWidth - 450 - padding;
        return { top: targetTop, left: targetLeft };
    };

    const handleMouseEnter = () => {
        hoverTimer.current = setTimeout(() => {
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
    };

    const toggleMute = (e) => {
        e.preventDefault(); e.stopPropagation(); 
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const newMuteState = !isMuted;
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ "event": "command", "func": isMuted ? 'unMute' : 'mute', "args": [] }), "*");
            setIsMuted(newMuteState);
            localStorage.setItem('netflix_global_mute', newMuteState.toString());
        }
    };

    // --- INSTANT ACTION HANDLERS ---
const safePayload = {
        id: safeId,
        type: type || 'movie',
        name: name || '',
        poster: poster || '',
        background: displayBg || '',
        posterShape: posterShape || 'poster'
    };

    // --- INSTANT ACTION HANDLERS ---
const toggleLibrary = (e) => {
        e.preventDefault(); e.stopPropagation();
        const newState = !localLibrary;
        setLocalLibrary(newState);
        localStorage.setItem(`stremio_lib_${safeId}`, newState.toString());
        
        core.transport.dispatch({ 
            action: 'Ctx', 
            args: { 
                action: newState ? 'AddToLibrary' : 'RemoveFromLibrary', 
                args: newState ? { id: safeId, type: type } : safeId 
            } 
        });
    };

    const toggleWatched = (e) => {
        e.preventDefault(); e.stopPropagation();
        const newState = !localWatched;
        setLocalWatched(newState); 
        localStorage.setItem(`stremio_watched_${safeId}`, newState.toString());
        
        core.transport.dispatch({ 
            action: 'Ctx', 
            args: { 
                action: 'MetaItemMarkAsWatched', 
                args: { meta_item: { id: safeId, type: type }, is_watched: newState } 
            } 
        });
    };

const handleDismiss = (e) => {
    e.preventDefault(); e.stopPropagation();

    try {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'RewindLibraryItem', // ← clears progress, stays in library
                args: safeId
            }
        });
    } catch (err) {
        console.error('Dismiss failed:', err);
    }

    if (cardRef.current) cardRef.current.style.display = 'none';
};

    const handlePlayNowClick = (e) => {
        e.preventDefault(); e.stopPropagation(); 
        window.location.hash = detailHref.replace('#', '');
    };

    const handleCardClick = (e) => {
        if (e.target.closest(`.${styles['hover-mute-btn']}`) || e.target.closest(`.${styles['circle-btn']}`) || e.target.closest(`.${styles['dismiss-btn']}`)) return;
        if (domProps.onClick) domProps.onClick(e);
    };

const hoverModal = isHovered ? ReactDOM.createPortal(
        <div className={styles['hover-modal']} style={{ top: modalPos.top, left: modalPos.left }} onMouseLeave={handleMouseLeave}>
            <div className={styles['hover-video-container']} onClick={handlePlayNowClick} style={{cursor: 'pointer'}}>
                {finalTrailerId ? (
                    <>
                        <iframe ref={iframeRef} src={`https://www.youtube.com/embed/${finalTrailerId}?autoplay=1&controls=0&mute=${initialMuteRef.current ? 1 : 0}&modestbranding=1&loop=1&playlist=${finalTrailerId}&enablejsapi=1&disablekb=1&fs=0&iv_load_policy=3&rel=0&playsinline=1`} allow="autoplay" frameBorder="0" className={styles['hover-video']} />
                        <button className={styles['hover-mute-btn']} onClick={toggleMute}>
                            {isMuted ? (
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                            )}
                        </button>
                    </>
                ) : (
                    <img src={displayBg} className={styles['hover-video-fallback']} />
                )}
            </div>
            
            <div className={styles['hover-info']}>
                <h4>{name}</h4>
                <div className={styles['hover-actions-row']}>
                    <a href={detailHref} className={styles['hover-play-btn']} onClick={handlePlayNowClick}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style={{marginRight: '6px'}}><path d="M8 5v14l11-7z"/></svg> Play
                    </a>
                    
                    <button className={styles['circle-btn']} onClick={toggleLibrary} title={localLibrary ? "Remove from Library" : "Add to Library"}>
                        {localLibrary ? (
                            <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/></svg>
                        ) : (
                            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>
                        )}
                    </button>

                    <button className={styles['circle-btn']} onClick={toggleWatched} title={localWatched ? "Mark as Unwatched" : "Mark as Watched"}>
                        {localWatched ? (
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z"/></svg>
                        )}
                    </button>
                </div>
                <p className={styles['hover-desc']}>{displayDesc}</p>
            </div>
        </div>,
        document.body
    ) : null;


    const baseShapeClass = `poster-shape-${posterShape || 'poster'}`;
    const wrapperClasses = classnames('meta-item', baseShapeClass, styles['netflix-card-wrapper'], className);

    return (
        <a ref={cardRef} href={detailHref} className={wrapperClasses} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={handleCardClick} {...domProps}>
            <img src={poster} alt={name} className={styles['standard-poster']} loading="lazy" />
            
            {localWatched && !isContinueWatching && (
                <div className={styles['watched-badge']}>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </div>
            )}
            
            {/* The 'X' Button that ONLY renders in the Continue Watching row */}
            {isContinueWatching && (
                <button className={styles['dismiss-btn']} onClick={handleDismiss} title="Remove from Continue Watching">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
                </button>
            )}

            {hoverModal}
        </a>
    );
};

module.exports = MetaItem;
