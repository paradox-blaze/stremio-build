import { useEffect } from 'react';

const useMediaSession = (
    videoState: VideoState,
    player: Player,
    onPlayRequested: () => void,
    onPauseRequested: () => void,
    onNextVideoRequested: () => void,
    onPreviousTrackRequested: () => void,
) => {
    useEffect(() => {
        if (!navigator.mediaSession) return;

        const playbackState = videoState.paused === null ? 'none' : videoState.paused ? 'paused' : 'playing';
        navigator.mediaSession.playbackState = playbackState;

        return () => {
            navigator.mediaSession.playbackState = 'none';
        };
    }, [videoState.paused]);

    useEffect(() => {
        if (!navigator.mediaSession) return;

        const metaItem = player.metaItem && player.metaItem?.type === 'Ready' ? player.metaItem.content as MetaItemPlayer : null;
        const videoId = player.selected ? player.selected?.streamRequest?.path?.id : null;
        const video = metaItem?.videos.find(({ id }) => id === videoId);

        const videoInfo = video?.season && video?.episode ? ` (${video.season}x${video.episode})` : null;
        const videoTitle = video ? `${video.title}${videoInfo}` : null;
        const metaTitle = metaItem ? metaItem.name : null;
        const imageUrl = metaItem ? metaItem.logo : null;

        const title = videoTitle ?? metaTitle;
        const artist = (videoTitle && metaTitle) ?? undefined;
        const artwork = imageUrl ? [{ src: imageUrl }] : undefined;

        if (title) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title,
                artist,
                artwork,
            });
        }
    }, [player.metaItem, player.selected]);

    useEffect(() => {
        if (!navigator.mediaSession) return;

        navigator.mediaSession.setActionHandler('play', onPlayRequested);
        navigator.mediaSession.setActionHandler('pause', onPauseRequested);

        const nextVideoCallback = player.nextVideo ? onNextVideoRequested : null;
        navigator.mediaSession.setActionHandler('nexttrack', nextVideoCallback);
        navigator.mediaSession.setActionHandler('previoustrack', onPreviousTrackRequested);

        return () => {
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('nexttrack', null);
            navigator.mediaSession.setActionHandler('previoustrack', null);
        };
    }, [player.nextVideo, onPlayRequested, onPauseRequested, onNextVideoRequested, onPreviousTrackRequested]);
};

export default useMediaSession;
