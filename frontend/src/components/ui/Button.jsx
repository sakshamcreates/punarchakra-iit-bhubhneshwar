import { Link } from "react-router-dom";

export default function Button({
  children,
  variant = "primary",
  className = "",
  as: Component = "button",
  icon,
  iconPosition = "left",
  ...props
}) {
  const classes = ["btn", `btn-${variant}`];
  if (className) classes.push(className);

  const combinedClassName = classes.join(" ");
  const iconNode = icon ? <span className="btn-icon">{icon}</span> : null;
  const content = (
    <>
      {iconPosition === "left" ? iconNode : null}
      <span>{children}</span>
      {iconPosition === "right" ? iconNode : null}
    </>
  );

  if (Component === Link) {
    return (
      <Link className={combinedClassName} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <Component className={combinedClassName} type={Component === "button" ? "button" : undefined} {...props}>
      {content}
    </Component>
  );
}
