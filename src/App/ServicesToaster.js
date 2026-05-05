// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useServices } = require('stremio/services');
const { useCore } = require('stremio/core');
const { useToast } = require('stremio/common');

const ServicesToaster = () => {
    const { dragAndDrop } = useServices();
    const core = useCore();
    const toast = useToast();
    React.useEffect(() => {
        const onCoreEvent = (name, data) => {
            switch (name) {
                case 'TorrentParsed': {
                    toast.show({
                        type: 'success',
                        title: 'Torrent file parsed',
                        timeout: 4000
                    });
                    break;
                }
                case 'MagnetParsed': {
                    toast.show({
                        type: 'info',
                        title: 'Magnet link parsed',
                        timeout: 4000
                    });
                    break;
                }
                case 'PlayingOnDevice': {
                    toast.show({
                        type: 'success',
                        title: `Stream opened in ${data.device}`,
                        timeout: 4000
                    });
                    break;
                }
            }
        };
        const onCoreError = (source, error) => {
            if (source.event === 'UserPulledFromAPI' && source.args.uid === null) return;
            if (source.event === 'LibrarySyncWithAPIPlanned' && source.args.uid === null) return;
            if (error.type === 'Other' && error.code === 3 && source.event === 'AddonInstalled' && source.args.transport_url.startsWith('https://www.strem.io/trakt/addon')) return;

            toast.show({
                type: 'error',
                title: source.event,
                message: error.message,
                timeout: 4000,
                dataset: {
                    type: 'CoreEvent'
                }
            });
        };
        const onDragAndDropError = (error) => {
            toast.show({
                type: 'error',
                title: error.message,
                message: error.file?.name,
                timeout: 4000
            });
        };
        core.on('event', onCoreEvent);
        core.on('error', onCoreError);
        dragAndDrop.on('error', onDragAndDropError);
        return () => {
            core.off('event', onCoreEvent);
            core.off('error', onCoreError);
            dragAndDrop.off('error', onDragAndDropError);
        };
    }, []);
    return null;
};

module.exports = ServicesToaster;
