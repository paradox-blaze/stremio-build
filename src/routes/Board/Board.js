// Copyright (C) 2017-2023 Smart code 203358507

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

const THRESHOLD = 5;

const HeroBanner = ({ catalogs }) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [heroItems, setHeroItems] = React.useState([]);

    React.useEffect(() => {
        // Changed cache key to 'v2' to force-clear your old movies!
        const cachedData = localStorage.getItem('netflix_hero_cache_v2');
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                const now = new Date().getTime();
                if (now - parsed.timestamp < 86400000 && parsed.items && parsed.items.length > 0) {
                    setHeroItems(parsed.items);
                    return; 
                }
            } catch (e) {
                console.error('Failed to parse hero cache', e);
            }
        }

        let customAddonPool = [];
        let cinemetaPool = [];

        catalogs.forEach(cat => {
            const catItems = cat?.content?.content || cat?.items || [];
            
            // Only accept items with a background, a description, and that are movies/series
            const validItems = catItems.filter(i => 
                i.background && 
                i.description && 
                (i.type === 'movie' || i.type === 'series')
            );
            
            // Check if this catalog is from Stremio's default Cinemeta
            const isCinemeta = cat.id?.includes('cinemeta') || cat.addon?.manifest?.id?.includes('cinemeta');
            
            if (isCinemeta) {
                cinemetaPool = [...cinemetaPool, ...validItems];
            } else {
                // This is a 3rd party addon like Watchly, TMDB, Trakt, etc.
                customAddonPool = [...customAddonPool, ...validItems];
            }
        });

        // Prioritize custom addons first, then Cinemeta. Shuffle both pools independently.
        let mixedPool = [
            ...customAddonPool.sort(() => 0.5 - Math.random()), 
            ...cinemetaPool.sort(() => 0.5 - Math.random())
        ];

        // Remove duplicates just in case
        const uniqueItems = Array.from(new Map(mixedPool.map(item => [item.id, item])).values());

        if (uniqueItems.length >= 5) {
            // Take the top 15 from our prioritized list, shuffle them, and lock in 5
            const topCandidates = uniqueItems.slice(0, 15).sort(() => 0.5 - Math.random());
            const selected = topCandidates.slice(0, 5);
            setHeroItems(selected);

            localStorage.setItem('netflix_hero_cache_v2', JSON.stringify({
                timestamp: new Date().getTime(),
                items: selected
            }));
        } else if (uniqueItems.length > 0) {
            setHeroItems(uniqueItems); 
        }
    }, [catalogs]); 

    React.useEffect(() => {
        if (heroItems.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % heroItems.length);
        }, 7000); // Bumped to 7 seconds so you have time to read descriptions
        return () => clearInterval(interval);
    }, [heroItems.length]);

    if (heroItems.length === 0) return null;

return (
        <div className={styles['netflix-hero-container']}>
            {heroItems.map((item, index) => {
                const detailHref = item.deepLinks?.metaDetails || `#/detail/${item.type}/${item.id}`;

                return (
                    <div 
                        key={item.id} 
                        className={classnames(styles['netflix-hero-slide'], { [styles['active']]: index === currentIndex })}
                        style={{ backgroundImage: `url(${item.background})` }}
                    >
                        {/* The Vignette Overlay */}
                        <div className={styles['netflix-hero-vignette']}>
                            <div className={styles['netflix-hero-content']}>
                                
                                {item.logo ? (
                                    <img src={item.logo} alt={item.name} className={styles['netflix-hero-logo']} />
                                ) : (
                                    <h1>{item.name}</h1>
                                )}
                                
                                {/* NEW: Action Row holding Button and Description side-by-side */}
                                <div className={styles['netflix-hero-action-row']}>
                                    <a href={detailHref} className={styles['netflix-btn-info']}>
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                            <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                                        </svg>
                                        More Info
                                    </a>
                                    
                                    <p className={styles['netflix-hero-description']}>
                                        {item.description}
                                    </p>
                                </div>

                            </div>
                        </div>
                    </div>
                );
            })}
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
                                itemComponent={ContinueWatchingItem}
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
