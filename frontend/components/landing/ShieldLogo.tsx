export function ShieldLogo({ className = "h-[26px] w-[26px]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M24 1L45 9V25C45 38 36 47.5 24 51C12 47.5 3 38 3 25V9L24 1Z"
        fill="#FDD213"
      />
      <path
        d="M16 15L32 15L32 20.5L23 28.5L32 28.5V37L16 37V31.5L25 23.5L16 23.5V15Z"
        fill="#000000"
      />
    </svg>
  );
}
