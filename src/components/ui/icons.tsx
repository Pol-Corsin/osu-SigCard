import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const ChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6l4 4 4-4" />
  </svg>
);
export const ArrowUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7" />
  </svg>
);
export const ArrowDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />
  </svg>
);
export const Check = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
export const Download = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10" />
  </svg>
);
export const Lock = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
  </svg>
);
export const Reset = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8a5 5 0 105-5H5.5M5.5 1v4h4" />
  </svg>
);
export const Spark = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2 2M10.6 10.6l2 2M3.4 12.6l2-2M10.6 5.4l2-2" />
  </svg>
);

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="none" stroke="#7FD6EE" strokeWidth="1.5" opacity=".55" />
      <circle cx="20" cy="20" r="12.5" fill="#FF5C9E" />
      <path
        d="M14 22.5c1.2 2.4 3.4 3.6 6 3.6 3.3 0 5.4-1.8 5.4-4.3 0-5.4-10.6-2.9-10.6-8 0-2.2 2-3.8 5-3.8 2.3 0 4 .9 5 2.6"
        fill="none"
        stroke="#100F16"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
