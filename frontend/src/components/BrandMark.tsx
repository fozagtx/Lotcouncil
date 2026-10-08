export function BrandMark({ className = 'size-9' }: { className?: string }) {
	return (
		<svg viewBox="0 0 36 36" className={className} aria-hidden="true">
			<rect width={36} height={36} rx={9} fill="var(--brand)" />
			<path
				d="M10 12.5h16M18 9v17.5M13.5 26.5h9M10 12.5l-3.4 7.4h6.8zM26 12.5l-3.4 7.4h6.8z"
				fill="none"
				stroke="#ffffff"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
