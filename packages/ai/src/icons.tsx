// The few icons of this package, inline and decorative (no icon library dependency).
const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function HandIcon() {
  return (
    <svg {...common} aria-hidden="true" focusable="false">
      <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...common} aria-hidden="true" focusable="false">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.3-2.4 3.3M12 17h.01" />
    </svg>
  );
}

export function CoinIcon() {
  return (
    <svg {...common} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...common} aria-hidden="true" focusable="false">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg {...common} aria-hidden="true" focusable="false">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
