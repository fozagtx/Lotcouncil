import type { CourtFailure } from '@/lib/court';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from './Icon';

const TITLES: Record<CourtFailure['kind'], string> = {
	idea: 'The court couldn’t read that idea',
	data: 'Couldn’t load the prices',
	network: 'Can’t reach the court',
	rate: 'Too many rulings for now',
	server: 'The court hit a problem',
	cut: 'The ruling was cut off'
};

export function ErrorBox({ failure, onretry }: { failure: CourtFailure; onretry: () => void }) {
	return (
		<Alert className="border-destructive/35 bg-danger-muted" role="alert">
			<Icon name="x" className="mt-0.5 size-4 text-danger-foreground" />
			<AlertTitle className="text-[13px]">{TITLES[failure.kind]}</AlertTitle>
			<AlertDescription className="text-[12.5px] text-subtle">
				{failure.message}
				<div className="mt-2 flex flex-wrap gap-2">
					<Button variant="secondary" size="sm" onClick={onretry}>
						<Icon name="retry" className="size-4" />
						Retry
					</Button>
				</div>
			</AlertDescription>
		</Alert>
	);
}
