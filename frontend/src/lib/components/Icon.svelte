<script lang="ts" module>
	export type IconName =
		| 'gavel'
		| 'scales'
		| 'check'
		| 'x'
		| 'dash'
		| 'image'
		| 'link'
		| 'file'
		| 'close'
		| 'moon'
		| 'spinner'
		| 'retry'
		| 'clock'
		| 'book'
		| 'shield'
		| 'code'
		| 'alert'
		| 'bolt';
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		class?: string;
		/** Accessible name; leave empty for decorative icons. */
		label?: string;
	}

	let { name, class: className = 'size-5', label }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	class={className}
	fill="none"
	stroke="currentColor"
	stroke-width="1.9"
	stroke-linecap="round"
	stroke-linejoin="round"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	{#if name === 'gavel'}
		<path d="m14.5 3.5 6 6M12.5 5.5l6 6M10 8l6 6M13.2 10.8 4 20M3 21h8" />
	{:else if name === 'scales'}
		<path d="M5 7h14M12 4v16M8 20h8M5 7l-3 6.5h6zM19 7l-3 6.5h6z" />
	{:else if name === 'check'}
		<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.6" />
	{:else if name === 'x'}
		<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke-width="2.6" />
	{:else if name === 'dash'}
		<path d="M6 12h12" stroke-width="2.6" />
	{:else if name === 'image'}
		<rect x="3.5" y="5" width="17" height="14" rx="2.5" />
		<path d="m4 16 4.5-4.5 4 4 2.5-2.5L20 17.5" />
	{:else if name === 'link'}
		<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
	{:else if name === 'file'}
		<path d="M7 3.5h7l4.5 4.5v12.5H7zM14 3.5V8h4.5M12.5 11v6M10 14.5l2.5 2.5 2.5-2.5" />
	{:else if name === 'close'}
		<path d="M6 6l12 12M18 6 6 18" />
	{:else if name === 'moon'}
		<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
	{:else if name === 'retry'}
		<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
	{:else if name === 'clock'}
		<circle cx="12" cy="12" r="8.5" />
		<path d="M12 7.5V12l3 2" />
	{:else if name === 'book'}
		<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
	{:else if name === 'shield'}
		<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z" />
		<path d="m8.8 12 2.2 2.2 4.3-4.4" />
	{:else if name === 'code'}
		<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
	{:else if name === 'alert'}
		<path d="M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2v.1" />
	{:else if name === 'bolt'}
		<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" fill="currentColor" stroke="none" />
	{:else if name === 'spinner'}
		<path d="M12 3a9 9 0 1 0 9 9" class="motion-safe:origin-center motion-safe:animate-spin" />
	{/if}
</svg>
