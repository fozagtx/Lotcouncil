<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		state: 'pass' | 'fail' | 'skip';
		size?: 'sm' | 'md';
	}

	let { state, size = 'md' }: Props = $props();
	const tone = $derived(state === 'pass' ? 'bg-success' : state === 'fail' ? 'bg-danger' : 'bg-neutral-mark');
</script>

<span
	class="mark inline-grid shrink-0 place-items-center rounded-full text-white {tone} {size === 'sm' ? 'size-4' : 'size-5'}"
	aria-hidden="true"
>
	<Icon name={state === 'pass' ? 'check' : state === 'fail' ? 'x' : 'dash'} class={size === 'sm' ? 'size-2.5' : 'size-3.5'} />
</span>
