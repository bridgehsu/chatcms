/** 置顶 / 图钉 */
export const IconPin = ({ filled = false }: { filled?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {filled ? (
      <path
        d="M14.5 3.5 20 9l-2.2.7-5.6 5.6-.7 2.8-2.5-2.5L4 20.5 3.5 20l4.9-4.9-2.5-2.5 2.8-.7L14 5.5z"
        fill="currentColor"
      />
    ) : (
      <path
        d="M14.5 3.5 20 9l-2.2.7-5.6 5.6-.7 2.8-2.5-2.5L4 20.5 3.5 20l4.9-4.9-2.5-2.5 2.8-.7L14 5.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);
