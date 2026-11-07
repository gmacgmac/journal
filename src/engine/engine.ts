// The engine entry: one export, `createEngine`. PLACEHOLDER until JR_02.
import type { Engine } from '../seam-types.ts';

export function createEngine(): Engine {
	return { tools: { list: () => [] } };
}
