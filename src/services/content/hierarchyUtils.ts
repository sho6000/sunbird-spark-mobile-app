import type { HierarchyContentNode } from '../../types/collectionTypes';

const COLLECTION_MIME = 'application/vnd.ekstep.content-collection';

// Mime types that cannot be downloaded for offline use
// YouTube/external URLs: streaming-only, no offline playback
// NOTE: QuestionSets (QuML) ARE downloadable — the ecar carries the full
// hierarchy + questions, which the QuML player replays from local storage.
export const NON_DOWNLOADABLE_MIME_TYPES = [
  'video/x-youtube',
  'text/x-url',
];

/**
 * Returns true if the node is a collection/unit (not a leaf content).
 */
export function isCollectionNode(node: HierarchyContentNode): boolean {
  return (node.mimeType ?? '').toLowerCase() === COLLECTION_MIME;
}

/**
 * Returns true if the content can be downloaded (has a downloadUrl and is not streaming-only).
 */
export function isDownloadable(node: HierarchyContentNode): boolean {
  if (!node.downloadUrl) return false;
  if (node.mimeType) {
    const mime = node.mimeType.toLowerCase();
    if (NON_DOWNLOADABLE_MIME_TYPES.some(m => m.toLowerCase() === mime)) return false;
  }
  return true;
}

/**
 * Recursively collects all leaf content nodes (non-collection) from a hierarchy tree.
 * Handles arbitrary nesting depth (units → sub-units → content).
 */
export function flattenLeafNodes(nodes: HierarchyContentNode[]): HierarchyContentNode[] {
  const leaves: HierarchyContentNode[] = [];

  function walk(list: HierarchyContentNode[]) {
    for (const node of list) {
      if (isCollectionNode(node)) {
        walk(node.children ?? []);
      } else {
        leaves.push(node);
      }
    }
  }

  walk(nodes);
  return leaves;
}

// Human-readable labels for non-downloadable mime types
const NON_DOWNLOADABLE_LABELS: Record<string, string> = {
  'video/x-youtube': 'YouTube',
  'text/x-url': 'External URL',
};

/**
 * Calculates the total download size (in bytes) for a set of hierarchy nodes.
 * Only counts downloadable leaf nodes. Skips nodes already in `localIdentifiers`.
 * Also returns labels for any non-downloadable content types found (for UI warnings).
 */
export function calculateDownloadSize(
  nodes: HierarchyContentNode[],
  localIdentifiers: Set<string>,
): { totalBytes: number; downloadableCount: number; alreadyLocalCount: number; skippedTypes: string[] } {
  const leaves = flattenLeafNodes(nodes);
  let totalBytes = 0;
  let downloadableCount = 0;
  let alreadyLocalCount = 0;
  const skippedTypeSet = new Set<string>();

  for (const leaf of leaves) {
    if (localIdentifiers.has(leaf.identifier)) {
      alreadyLocalCount++;
      continue;
    }
    if (isDownloadable(leaf)) {
      totalBytes += leaf.size ?? 0;
      downloadableCount++;
    } else if (leaf.mimeType && NON_DOWNLOADABLE_MIME_TYPES.includes(leaf.mimeType)) {
      const label = NON_DOWNLOADABLE_LABELS[leaf.mimeType] ?? leaf.mimeType;
      skippedTypeSet.add(label);
    }
  }

  return { totalBytes, downloadableCount, alreadyLocalCount, skippedTypes: [...skippedTypeSet] };
}

/**
 * Filters a hierarchy tree to include only units/sub-units that contain
 * at least one leaf node present in `localIdentifiers`.
 * Used for the "View Downloaded Only" toggle.
 */
export function filterHierarchyTree(
  nodes: HierarchyContentNode[],
  localIdentifiers: Set<string>,
): HierarchyContentNode[] {
  return nodes
    .map((node) => {
      if (isCollectionNode(node)) {
        const filteredChildren = filterHierarchyTree(node.children ?? [], localIdentifiers);
        if (filteredChildren.length === 0) return null;
        return { ...node, children: filteredChildren };
      }
      // Leaf node — include only if downloaded locally
      return localIdentifiers.has(node.identifier) ? node : null;
    })
    .filter((n): n is HierarchyContentNode => n !== null);
}

/**
 * Formats byte count into a human-readable string (e.g., "12.5 MB").
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`;
}
