interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
}

const PRESET_COLORS = ['#5b8def', '#e74c3c', '#27ae60', '#f4c842'];

export function colorForName(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PRESET_COLORS[hash % PRESET_COLORS.length];
}

export function Avatar({ name, color, size = 36 }: AvatarProps) {
  const bg = color ?? colorForName(name);
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}
