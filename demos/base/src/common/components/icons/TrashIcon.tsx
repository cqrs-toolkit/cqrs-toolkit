import { IconProps } from './IconProps.js'

export const TrashIcon = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? 20}
    height={props.size ?? 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? 2}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    {/* lid handle */}
    <path d="M9 3h6" />
    {/* lid */}
    <path d="M3 6h18" />
    {/* body */}
    <path d="M19 6l-1 14H6L5 6" />
    {/* inner lines */}
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)
