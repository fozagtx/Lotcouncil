import { BrandMark } from './BrandMark';
import { Icon, type IconName } from './Icon';
import { useTheme } from '@/components/theme-provider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Props {
	onhow: () => void;
	onaudit: () => void;
	onrecent: () => void;
	ontrial: () => void;
}

export function Rail({ onhow, onaudit, onrecent, ontrial }: Props) {
	const { theme, setTheme } = useTheme();
	const items: { label: string; icon: IconName; action: () => void; current?: boolean }[] = [
		{ label: 'Court: new trial', icon: 'scales', action: ontrial, current: true },
		{ label: 'Recent rulings', icon: 'clock', action: onrecent },
		{ label: 'How the court works', icon: 'book', action: onhow },
		{ label: 'Check an audit file', icon: 'shield', action: onaudit }
	];

	return (
		<nav className="flex w-12 shrink-0 flex-col items-center gap-1.5 bg-rail py-3 sm:w-14" aria-label="Lotcouncil">
			<a href="./" className="mb-2 rounded-md" aria-label="Lotcouncil home">
				<BrandMark />
			</a>
			{items.map((item) => (
				<Tooltip key={item.label}>
					<TooltipTrigger asChild>
						<button
							type="button"
							className={cn(
								'relative grid size-10 cursor-pointer place-items-center rounded-md text-rail-foreground transition-colors hover:bg-rail-active hover:text-white',
								item.current && 'bg-rail-active text-white'
							)}
							aria-label={item.label}
							aria-current={item.current ? 'page' : undefined}
							onClick={item.action}
						>
							{item.current && <span className="absolute top-1.5 bottom-1.5 -left-1.5 w-[3px] rounded-r bg-primary" aria-hidden="true" />}
							<Icon name={item.icon} />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">{item.label}</TooltipContent>
				</Tooltip>
			))}
			<Tooltip>
				<TooltipTrigger asChild>
					<a
						href="/api/docs"
						target="_blank"
						rel="external noopener"
						className="grid size-10 place-items-center rounded-md text-rail-foreground transition-colors hover:bg-rail-active hover:text-white"
						aria-label="API documentation (opens in a new tab)"
					>
						<Icon name="code" />
					</a>
				</TooltipTrigger>
				<TooltipContent side="right">API documentation</TooltipContent>
			</Tooltip>
			<button
				type="button"
				className="mt-auto grid size-10 cursor-pointer place-items-center rounded-md text-rail-foreground transition-colors hover:bg-rail-active hover:text-white"
				aria-label="Switch between light and dark mode"
				title="Light or dark"
				onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
			>
				<Icon name={theme === 'dark' ? 'sun' : 'moon'} />
			</button>
		</nav>
	);
}
