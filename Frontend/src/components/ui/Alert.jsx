export default function Alert({ children, variant = "error" }) {
  const styles = variant === "error"
    ? "bg-rose-50 text-rose-700"
    : "bg-indigo-50 text-indigo-700";
  return <div className={`rounded-xl px-3.5 py-3 text-sm ${styles}`}>{children}</div>;
}