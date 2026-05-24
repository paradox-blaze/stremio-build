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
const HeroBanner = ({ catalogs, scrollContainerRef }) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [heroItems, setHeroItems] = React.useState([]);
    const bgRef = React.useRef(null);

    React.useEffect(() => {
        // Changed to v3 to force-clear the old Cinemeta cache!
        const cachedData = localStorage.getItem('netflix_hero_cache_v4');
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                const now = new Date().getTime();
                if (now - parsed.timestamp < 3600000 && parsed.items && parsed.items.length > 0) {
                    setHeroItems(parsed.items);
                    return; 
                }
            } catch (e) {
                console.error('Failed to parse hero cache', e);
            }
        }

        let watchlyPool = [];
        let customAddonPool = [];
        let cinemetaPool = [];

        catalogs.forEach(cat => {
            const catItems = cat?.content?.content || cat?.items || [];
            
            // RELAXED FILTER: We no longer require a description, only a background image!
            const validItems = catItems.filter(i => 
                i.background && (i.type === 'movie' || i.type === 'series')
            );
            
            const catId = (cat.id || '').toLowerCase();
            const manifestId = (cat.addon?.manifest?.id || '').toLowerCase();
            const manifestName = (cat.addon?.manifest?.name || '').toLowerCase();
            
            // Identify where the catalog came from
            const isCinemeta = catId.includes('cinemeta') || manifestId.includes('cinemeta');
            const isWatchly = catId.includes('watchly') || manifestId.includes('watchly') || manifestName.includes('watchly');
            
            if (isWatchly) {
                watchlyPool = [...watchlyPool, ...validItems];
            } else if (isCinemeta) {
                cinemetaPool = [...cinemetaPool, ...validItems];
            } else {
                customAddonPool = [...customAddonPool, ...validItems];
            }
        });

        // Shuffle each pool independently
        watchlyPool = watchlyPool.sort(() => 0.5 - Math.random());
        customAddonPool = customAddonPool.sort(() => 0.5 - Math.random());
        cinemetaPool = cinemetaPool.sort(() => 0.5 - Math.random());

        // FORCE Watchly to the absolute front of the line, followed by other addons, then Cinemeta last
        let mixedPool = [...watchlyPool, ...customAddonPool, ...cinemetaPool];

        const uniqueItems = Array.from(new Map(mixedPool.map(item => [item.id, item])).values());

        if (uniqueItems.length >= 5) {
            const selected = uniqueItems.slice(0, 5);
            setHeroItems(selected);
            localStorage.setItem('netflix_hero_cache_v3', JSON.stringify({
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
        }, 7000);
        return () => clearInterval(interval);
    }, [heroItems.length]);

   React.useEffect(() => {
        const container = scrollContainerRef?.current;
        if (!container) return;

        const syncScroll = () => {
            if (bgRef.current) {
                bgRef.current.style.transform = `translateY(-${container.scrollTop}px)`;
            }
        };

        // 1. Fire instantly when you navigate back to the page
        syncScroll();
        
        // 2. Catch the browser's native "Scroll Restoration" a split-second later
        const fallbackSync = setTimeout(syncScroll, 50);

        // 3. Listen for normal active scrolling
        container.addEventListener('scroll', syncScroll, { passive: true });
        
        return () => {
            container.removeEventListener('scroll', syncScroll);
            clearTimeout(fallbackSync);
        };
    }, [scrollContainerRef]);

        React.useEffect(() => {
        const container = scrollContainerRef?.current;
        if (container && bgRef.current) {
            bgRef.current.style.transform = `translateY(-${container.scrollTop}px)`;
        }
    }, [currentIndex, scrollContainerRef]);
    if (heroItems.length === 0) return null;

    return (
        <div className={styles['netflix-hero-container']}>
            {heroItems.map((item, index) => {
                const isActive = index === currentIndex;
                const detailHref = item.deepLinks?.metaDetails || `#/detail/${item.type}/${item.id}`;
                
                // Fallback text just in case Watchly didn't provide a description
                const displayDescription = item.description || `Explore this trending ${item.type} and discover why it is captivating audiences right now.`;

                return (
                    <React.Fragment key={item.id}>
                        <div 
                            ref={isActive ? bgRef : null}
                            className={classnames(styles['netflix-hero-slide'], { [styles['active']]: isActive })}
                            style={{ backgroundImage: `url(${item.background})` }}
                        >
                            <div className={styles['netflix-hero-vignette']} />
                        </div>

                        <div className={classnames(styles['netflix-hero-content-wrapper'], { [styles['active']]: isActive })}>
                            <div className={styles['netflix-hero-content']}>
                                <h1>{item.name}</h1>
                                
                                <div className={styles['netflix-hero-action-row']}>
                                    <a href={detailHref} className={styles['netflix-btn-info']}>
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                            <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                                        </svg>
                                        More Info
                                    </a>
                                    <p className={styles['netflix-hero-description']}>
                                        {displayDescription}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
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
