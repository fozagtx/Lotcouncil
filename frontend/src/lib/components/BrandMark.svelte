<script lang="ts">
	let { class: className = 'size-8' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 32 32" class={className} aria-hidden="true">
	<rect x="1" y="1" width="30" height="30" rx="8" fill="var(--brand-mark)" />
	<path
		d="M9 10h14M16 7v17M11 24h10M9 10l-3.5 7.5h7zM23 10l-3.5 7.5h7z"
		fill="none"
		stroke="var(--brand-mark-ink)"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
