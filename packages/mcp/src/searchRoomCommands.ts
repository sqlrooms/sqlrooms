import type {RoomCommandDescriptor} from '@sqlrooms/room-store';

/** Rank command descriptors by intent using the same bounded search on every host. */
export function searchRoomCommands(
  commands: RoomCommandDescriptor[],
  rawQuery = '',
  rawLimit = 10,
) {
  const query = rawQuery.trim().toLowerCase();
  const limit = Math.min(50, Math.max(1, rawLimit));
  return commands
    .map((descriptor) => ({
      descriptor,
      score: scoreCommand(descriptor, query),
    }))
    .filter((entry) => !query || entry.score > 0)
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.descriptor.id.localeCompare(second.descriptor.id),
    )
    .slice(0, limit)
    .map(({descriptor, score}) => ({
      id: descriptor.id,
      name: descriptor.name,
      description: descriptor.description,
      group: descriptor.group,
      enabled: descriptor.enabled,
      riskLevel: descriptor.riskLevel,
      requiresConfirmation: descriptor.requiresConfirmation,
      score,
    }));
}

function scoreCommand(command: RoomCommandDescriptor, query: string) {
  if (!query) return 1;
  const terms = query.split(/\s+/).filter(Boolean);
  const id = command.id.toLowerCase();
  const name = command.name.toLowerCase();
  const description = command.description?.toLowerCase() ?? '';
  const keywords = command.keywords?.join(' ').toLowerCase() ?? '';
  return terms.reduce((score, term) => {
    if (id === term) return score + 20;
    if (id.includes(term)) return score + 10;
    if (name.includes(term)) return score + 6;
    if (keywords.includes(term)) return score + 4;
    if (description.includes(term)) return score + 2;
    return score;
  }, 0);
}
