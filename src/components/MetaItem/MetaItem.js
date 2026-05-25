const React = require('react');
const ReactDOM = require('react-dom');
const classnames = require('classnames');
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
    const { className, item, meta, ...domProps } = props; 
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
                fetch(metaUrl)
                    .then(res => res.json())
                    .then(data => {
                        if (data?.meta) {
                            setExtendedMeta(data.meta); 
                            const fetchedTrailers = data.meta.trailers || data.meta.trailerStreams || [];
                            if (fetchedTrailers.length > 0) {
                                setDynamicTrailer(fetchedTrailers[0].ytId || fetchedTrailers[0].source);
                            }
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

    // THE CLICK FIX: Explicitly forcefully routes to the movie page when Play Now is clicked
    const handlePlayNowClick = (e) => {
        e.preventDefault();
        e.stopPropagation(); 
        window.location.hash = detailHref.replace('#', '');
    };

    const hoverModal = isHovered ? ReactDOM.createPortal(
        <div 
            className={styles['hover-modal']} 
            style={{ top: modalPos.top, left: modalPos.left }}
            onMouseLeave={handleMouseLeave}
        >
            <div className={styles['hover-video-container']}>
                {finalTrailerId ? (
                    <>
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
                    <img src={displayBg} className={styles['hover-video-fallback']} />
                )}
            </div>
            
            <div className={styles['hover-info']}>
                <h4>{name}</h4>
                <p className={styles['hover-desc']}>{displayDesc}</p>
                <a href={detailHref} className={styles['hover-play-btn']} onClick={handlePlayNowClick}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style={{marginRight: '6px'}}><path d="M8 5v14l11-7z"/></svg>
                    Play Now
                </a>
            </div>
        </div>,
        document.body
    ) : null;

    const baseShapeClass = `poster-shape-${posterShape || 'poster'}`;
    const wrapperClasses = classnames('meta-item', baseShapeClass, styles['netflix-card-wrapper'], className);

    return (
        /* RESTORED NATIVE CLICK BEHAVIOR: Using <a> instead of <div> allows Stremio's native side-panel to work! */
        <a 
            ref={cardRef} 
            href={detailHref}
            className={wrapperClasses}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            {...domProps} 
        >
            <img src={poster} alt={name} className={styles['standard-poster']} loading="lazy" />
            {hoverModal}
        </a>
    );
};

module.exports = MetaItem;
