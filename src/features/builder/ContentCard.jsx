import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BookmarkPlus, Copy, GripHorizontal, Image as ImageIcon, SquarePlay, Trash2, Type } from 'lucide-react'
import AutoTextarea from '../../lib/AutoTextarea.jsx'
import { youtubeId } from '../../lib/formModel.js'
import ImagePicker from './ImagePicker.jsx'
import ShowIf from './ShowIf.jsx'

const KIND = {
  text: { label: 'Title and description', icon: Type },
  image: { label: 'Image', icon: ImageIcon },
  video: { label: 'Video', icon: SquarePlay },
}

// A non-question block in the builder: title-and-description, image, or
// YouTube video. Same card shape as questions so the list reads as one.
export default function ContentCard({ item, active, onActivate, change, onDuplicate, onDelete, onKeep, showIf }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })
  const kind = KIND[item.type]

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`q-card c-card${active ? ' q-card-active' : ''}${isDragging ? ' q-card-dragging' : ''}`}
      onClick={() => !active && onActivate()}
      onFocus={() => !active && onActivate()}
      aria-label={item.title || kind.label}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="q-drag"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripHorizontal size={16} />
      </button>

      <span className="c-kind">
        <kind.icon size={14} /> {kind.label}
      </span>

      {active ? (
        <>
          <AutoTextarea
            className="c-title-input"
            value={item.title}
            placeholder={item.type === 'text' ? 'Untitled title' : 'Title (optional)'}
            aria-label="Title"
            onChange={(e) => {
              const title = e.target.value
              change('title', (x) => ({ ...x, title }))
            }}
          />
          {item.type === 'text' && (
            <AutoTextarea
              className="q-desc-input"
              value={item.description}
              placeholder="Description (optional)"
              aria-label="Description"
              onChange={(e) => {
                const description = e.target.value
                change('description', (x) => ({ ...x, description }))
              }}
            />
          )}
          {item.type === 'image' && (
            <div className="c-media">
              {item.image ? (
                <img src={item.image.url} alt={item.title || ''} />
              ) : (
                <p className="key-note">Upload an image (up to 10 MB).</p>
              )}
              <ImagePicker
                variant="button"
                label={item.image ? 'Replace image' : 'Upload image'}
                onPicked={(image) => change('image', (x) => ({ ...x, image }))}
              />
            </div>
          )}
          {item.type === 'video' && <VideoField item={item} change={change} />}

          {showIf && <ShowIf {...showIf} />}
          <footer className="q-foot">
            <button
              type="button"
              className="icon-btn"
              onClick={onKeep}
              aria-label="Keep (save it to paste later)"
              title="Keep: save it to paste later, in any form"
            >
              <BookmarkPlus size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onDuplicate}
              aria-label="Duplicate"
              title="Duplicate"
            >
              <Copy size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onDelete}
              aria-label="Delete"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </footer>
        </>
      ) : (
<>
        <ContentPreview item={item} />
          {showIf && <ShowIf {...showIf} compact />}
        </>
      )}
    </section>
  )
}

function VideoField({ item, change }) {
  return (
    <div className="c-media">
      <input
        className="c-url"
        defaultValue={item.videoId ? `https://youtu.be/${item.videoId}` : ''}
        placeholder="Paste a YouTube link"
        aria-label="YouTube link"
        onChange={(e) => {
          const videoId = youtubeId(e.target.value)
          change('videoId', (x) => ({ ...x, videoId }))
        }}
      />
      {item.videoId ? (
        <img
          className="c-video-thumb"
          src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
          alt="Video preview"
        />
      ) : (
        <p className="key-note">Links from youtube.com or youtu.be work.</p>
      )}
    </div>
  )
}

function ContentPreview({ item }) {
  return (
    <div className="q-preview">
      {item.title && <p className="s-preview-title c-preview-title">{item.title}</p>}
      {item.type === 'text' && item.description && (
        <p className="q-preview-desc">{item.description}</p>
      )}
      {item.type === 'image' &&
        (item.image ? (
          <img className="q-image-thumb" src={item.image.url} alt="" />
        ) : (
          <p className="q-hint">No image yet</p>
        ))}
      {item.type === 'video' &&
        (item.videoId ? (
          <img
            className="q-image-thumb"
            src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
            alt="Video preview"
          />
        ) : (
          <p className="q-hint">No video yet</p>
        ))}
      {item.type === 'text' && !item.title && !item.description && (
        <p className="q-hint">Untitled title</p>
      )}
    </div>
  )
}
