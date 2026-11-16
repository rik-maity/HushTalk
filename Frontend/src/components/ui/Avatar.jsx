export default function Avatar({ label = "H", size = "md" }) {
  const initials = label.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const sizeClass = size === "sm" ? "h-9 w-9 rounded-xl" : "h-11 w-11 rounded-2xl";
  return (
    <div className={`grid shrink-0 place-items-center bg-gradient-to-br from-indigo-100 to-violet-100 text-sm font-bold text-indigo-600 ${sizeClass}`}>
      {initials || "H"}
    </div>
  );
}