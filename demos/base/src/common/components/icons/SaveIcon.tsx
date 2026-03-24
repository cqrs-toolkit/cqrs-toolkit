import { IconProps } from './IconProps.js'

export const SaveIcon = (props: IconProps) => (
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
    {/* outer body */}
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    {/* label area */}
    <rect x="7" y="3" width="10" height="5" rx="0.5" />
    {/* disk slot notch on label */}
    <line x1="11" y1="3" x2="11" y2="8" />
    {/* storage area bottom */}
    <rect x="7" y="13" width="10" height="8" />
  </svg>
)
