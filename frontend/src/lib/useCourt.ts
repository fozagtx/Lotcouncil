import { useSyncExternalStore } from 'react';
import { CourtSession } from './court';

let instance: CourtSession | null = null;

export function getSession(): CourtSession {
	if (!instance) instance = new CourtSession();
	return instance;
}

/** Subscribe a component to the shared session; re-renders whenever court state changes. */
export function useCourtSession(): CourtSession {
	const session = getSession();
	useSyncExternalStore(
		session.subscribe,
		() => session.version,
		() => session.version
	);
	return session;
}
