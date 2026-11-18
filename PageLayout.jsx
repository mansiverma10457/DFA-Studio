export default function PageLayout({ eyebrow, title, description, actions, children }) {
  return (
    <section className="page-section">
      <div className="page-heading">
        {(eyebrow || title || description) && <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          {title && <h1>{title}</h1>}
          {description && <p className="page-description">{description}</p>}
        </div>}
        {actions && <div className="page-heading-actions">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
