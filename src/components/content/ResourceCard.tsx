import React from 'react';
import { IonImg } from '@ionic/react';
import { useHistory, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ContentSearchItem } from '../../types/contentTypes';
import { getPlaceholderImage } from '../../utils/placeholderImages';
import './ContentCards.css';

interface ResourceCardProps {
    item: ContentSearchItem;
}

const ArrowRightIcon = () => (
    <svg className="resource-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </svg>
);

const getMimeTypeKey = (mimeType?: string): string => {
    switch (mimeType) {
        case 'video/x-youtube':
        case 'video/webm':
        case 'video/mp4':
            return 'mimeType.video';
        case 'application/pdf':
            return 'mimeType.pdf';
        case 'application/epub':
            return 'mimeType.epub';
        case 'application/vnd.ekstep.scorm-archive':
        case 'application/vnd.ekstep.html-archive':
            return 'mimeType.html';
        case 'application/vnd.ekstep.ecml-archive':
            return 'mimeType.ecml';
        case 'application/vnd.ekstep.h5p-archive':
            return 'mimeType.h5p';
        default:
            return 'mimeType.view';
    }
};

const ResourceCard: React.FC<ResourceCardProps> = ({ item }) => {
    const history = useHistory();
    const location = useLocation<{ parentRoute?: string }>();
    const { t } = useTranslation();
    const imageUrl = item.posterImage || item.appIcon || item.thumbnail || getPlaceholderImage(item.identifier);
    const viewLabel = t(getMimeTypeKey(item.mimeType));

    const handleNavigate = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        history.push({
            pathname: `/content/${item.identifier}`,
            state: { parentRoute: location.state?.parentRoute || (['/explore', '/home', '/my-learning'].includes(location.pathname) ? location.pathname : undefined) }
        });
    };

    return (
        <div
            role="button"
            tabIndex={0}
            className="resource-card"
            onClick={handleNavigate}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(e); if (e.key === ' ') { e.preventDefault(); handleNavigate(e); } }}
        >
            {/* Image with overlay — mirrors CollectionCard structure */}
            <div className="resource-card-image-inner">
                <IonImg src={imageUrl} alt={item.name} className="resource-card-image" />
                <div className="resource-card-gradient" />
                <div className="resource-card-badge">{viewLabel}</div>
            </div>

            {/* Content section */}
            <div className="resource-card-content">
                <h3 className="resource-card-title">{item.name || t('untitled')}</h3>
                <div className="resource-card-action">
                    {viewLabel} <ArrowRightIcon />
                </div>
            </div>
        </div>
    );
};

export default ResourceCard;
