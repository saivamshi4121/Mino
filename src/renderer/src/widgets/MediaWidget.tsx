/**
 * MediaWidget — now-playing display for compact and expanded island states.
 * Receives media info via props; sends play/pause/next/prev via window.island.media.command.
 */

import type { MediaInfo, MediaCommand } from '../../../shared/moduleEvents'

interface MediaWidgetProps {
  media: MediaInfo
  onCommand: (cmd: MediaCommand) => void
}

/** Compact view: scrolling title + artist + play/pause indicator */
export function MediaCompactWidget({ media }: { media: MediaInfo }): React.JSX.Element {
  const isPlaying = media.status === 'Playing'
  const label = media.title
    ? media.artist
      ? `${media.title} · ${media.artist}`
      : media.title
    : 'Media'

  return (
    <div className="media-compact">
      {/* Play/pause indicator dot */}
      <span className={`media-compact-dot ${isPlaying ? 'media-compact-dot--playing' : ''}`} />
      <span className="media-compact-label">{label}</span>
    </div>
  )
}

/** Expanded view: title, artist, and transport controls */
export function MediaExpandedWidget({ media, onCommand }: MediaWidgetProps): React.JSX.Element {
  const isPlaying = media.status === 'Playing'

  return (
    <section className="media-card">
      <div className="media-card-heading">Now Playing</div>

      <div className="media-card-track">
        <span className="media-card-title">{media.title || '—'}</span>
        {media.artist && <span className="media-card-artist">{media.artist}</span>}
      </div>

      <div className="media-controls">
        {/* Previous */}
        <button
          className="media-btn"
          aria-label="Previous track"
          onClick={() => onCommand('prev')}
        >
          {/* ⏮ */}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <rect x="3" y="4" width="2" height="12" rx="1" />
            <path d="M17 4L8 10l9 6V4z" />
          </svg>
        </button>

        {/* Play / Pause */}
        <button
          className="media-btn media-btn--primary"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={() => onCommand(isPlaying ? 'pause' : 'play')}
        >
          {isPlaying ? (
            /* Pause icon */
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <rect x="5" y="4" width="3" height="12" rx="1" />
              <rect x="12" y="4" width="3" height="12" rx="1" />
            </svg>
          ) : (
            /* Play icon */
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6 4l12 6-12 6V4z" />
            </svg>
          )}
        </button>

        {/* Next */}
        <button className="media-btn" aria-label="Next track" onClick={() => onCommand('next')}>
          {/* ⏭ */}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <rect x="15" y="4" width="2" height="12" rx="1" />
            <path d="M3 4l9 6-9 6V4z" />
          </svg>
        </button>
      </div>
    </section>
  )
}
