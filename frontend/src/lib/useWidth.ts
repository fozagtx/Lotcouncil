import { useEffect, useRef, useState } from 'react';

/** Track an element's content width for SVG viewBox sizing. */
export function useWidth<T extends HTMLElement>() {
	const ref = useRef<T | null>(null);
	const [width, setWidth] = useState(0);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const measure = () => setWidth(el.getBoundingClientRect().width);
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		measure();
		const raf = requestAnimationFrame(measure);
		return () => {
			ro.disconnect();
			cancelAnimationFrame(raf);
		};
	}, []);
	return { ref, width };
}
