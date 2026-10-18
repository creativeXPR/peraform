// A non-question block on the public form: title-and-description, image,
// or YouTube video (privacy-enhanced embed, no cookies until played).
export default function ContentBlock({ item }) {
  return (
    <section className="respond-card respond-content">
      {item.title && <h2>{item.title}</h2>}
      {item.type === 'text' && item.description && (
        <p className="respond-desc">{item.description}</p>
      )}
      {item.type === 'image' && item.image && (
        <img className="respond-image" src={item.image.url} alt={item.title || ''} loading="lazy" />
      )}
      {item.type === 'video' && item.videoId && (
        <div className="respond-video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.videoId}`}
            title={item.title || 'Video'}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </section>
  )
}
