export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-white/20 border-t-teal"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
