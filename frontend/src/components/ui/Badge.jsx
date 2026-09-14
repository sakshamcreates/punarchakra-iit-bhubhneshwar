export default function Badge({ children, variant = "default", className = "" }) {
  const classes = ["badge"];
  if (variant !== "default") classes.push(`badge-${variant}`);
  if (className) classes.push(className);

  return <span className={classes.join(" ")}>{children}</span>;
}
