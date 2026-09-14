export default function Card({ children, className = "", hoverable = false, ...props }) {
  const classes = ["card"];
  if (hoverable) classes.push("card--hoverable");
  if (className) classes.push(className);

  return (
    <article className={classes.join(" ")} {...props}>
      {children}
    </article>
  );
}
