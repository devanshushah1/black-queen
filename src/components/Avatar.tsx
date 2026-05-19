interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
}

const PRESET_GRADIENTS = [
  'from-[#1a365d] to-[#2a4365]', // Deep Royal Blue
  'from-[#742a2a] to-[#9b2c2c]', // Rich Velvet Red
  'from-[#22543d] to-[#2f855a]', // Deep Emerald Green
  'from-[#744210] to-[#975a16]', // Amber Bronze
];

export function colorForName(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PRESET_GRADIENTS[hash % PRESET_GRADIENTS.length];
}

export function Avatar({ name, color, size = 36 }: AvatarProps) {
  const bgGradient = color ?? colorForName(name);
  const initial = name.charAt(0).toUpperCase();
  
  return (
    <div
      className={`relative flex items-center justify-center rounded-full font-extrabold text-white shadow-lg border border-gold-500/50 bg-gradient-to-br ${bgGradient} transition-transform duration-300 hover:scale-105`}
      style={{ 
        width: size, 
        height: size, 
        fontSize: size * 0.42,
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.15)'
      }}
    >
      {/* Inner gold circular accent thread */}
      <div className="absolute inset-[2px] border border-gold-400/20 rounded-full pointer-events-none" />
      
      {/* Dynamic letter shadow for embossed depth effect */}
      <span className="relative drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] tracking-tighter text-gold-300 font-serif">
        {initial}
      </span>
    </div>
  );
}
