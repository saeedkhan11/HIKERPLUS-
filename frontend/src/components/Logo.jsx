import { Footprints } from 'lucide-react';

export default function Logo({ className = '', size = 26 }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-teal ${className}`}
      style={{ width: size + 14, height: size + 14 }}
    >
      <Footprints size={size} className="text-white" strokeWidth={2.2} />
    </div>
  );
}
