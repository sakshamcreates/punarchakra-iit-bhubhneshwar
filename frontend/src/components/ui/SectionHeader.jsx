export default function SectionHeader({ eyebrow, title, description, align = "left" }) {
  return (
    <div className={`section-header section-header--${align}`}>
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      {title ? <h2>{title}</h2> : null}
      {description ? <p>{description}</p> : null}
    </div>
  );
}
