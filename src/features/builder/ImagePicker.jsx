import { useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { uploadFormImage } from '../../lib/upload.js'
import { useAuth } from '../auth/useAuth.js'

// "Add image" control: picks an image, uploads it to the creator's folder
// and calls onPicked({ url, path }). `variant` is 'icon' (a small button, as
// next to a question title) or 'button' (a labelled button).
export default function ImagePicker({ onPicked, variant = 'icon', label = 'Add image' }) {
  const { user } = useAuth()
  const inputRef = useRef(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same file again still fires
    if (!file) return
    setError('')
    setProgress(0)
    try {
      onPicked(await uploadFormImage(file, user.uid, setProgress))
    } catch (err) {
      setError(err.message?.startsWith('Images') || err.message?.startsWith('Choose') ? err.message : 'Couldn’t upload that image.')
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null
  return (
    <span className="image-picker">
      <button
        type="button"
        className={variant === 'icon' ? 'icon-btn' : 'btn btn-outline image-picker-btn'}
        onClick={() => inputRef.current.click()}
        disabled={busy}
        aria-label={label}
        title={label}
      >
        <ImagePlus size={variant === 'icon' ? 18 : 16} />
        {variant !== 'icon' && (busy ? `Uploading… ${Math.round(progress * 100)}%` : label)}
      </button>
      {variant === 'icon' && busy && <span className="image-picker-progress">{Math.round(progress * 100)}%</span>}
      {error && (
        <span className="image-picker-error" role="alert">
          {error}
        </span>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
    </span>
  )
}
