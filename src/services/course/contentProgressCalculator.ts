/**
 * Portal-aligned content progress calculator.
 *
 * Playback types (video, PDF, EPUB):
 *   → 100 if: endpageseen OR visitedcontentend OR (totalLength > 0 AND (visitedLength*100)/totalLength > 20)
 *   → else raw progress value
 *
 * Other types (H5P, HTML archive):
 *   → 100 if progress >= 0
 *   → else 0
 *
 * Rest (QuML/ECML assessments):
 *   → 100 if progress >= 100
 *   → else 0
 */

const PLAYBACK_MIME_TYPES = [
  'video/x-youtube',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'application/epub',
  'application/epub+zip'
];

const OTHER_MIME_TYPES = [
  'application/vnd.ekstep.h5p-archive',
  'application/vnd.ekstep.html-archive',
  'application/vnd.ekstep.scorm-archive',
];

export interface ConsumptionSummary {
  progress?: number;
  visitedLength?: number;
  visitedlength?: number;
  totalLength?: number;
  totallength?: number;
  endpageseen?: boolean;
  visitedcontentend?: boolean;
  [key: string]: unknown;
}

function absoluteProgress(progress: number, threshold: number): number {
  const p = Number(progress);
  if (Number.isNaN(p)) return 0;
  return p >= threshold ? 100 : 0;
}

function calculatePlaybackProgress(
  progress: number,
  visitedLength: number,
  totalLength: number,
  endPageSeen: boolean,
  visitedContentEnd: boolean,
): number {
  if (
    endPageSeen ||
    visitedContentEnd ||
    (totalLength > 0 && (visitedLength * 100) / totalLength > 20)
  ) {
    return 100;
  }
  return progress;
}

/**
 * Sunbird telemetry summary can be an array of single-key objects
 * e.g. [{ progress: 100 }, { totallength: 43 }, { visitedlength: 30 }].
 * Merge into one flat object.
 */
export function mergeSummary(summary: ConsumptionSummary[]): ConsumptionSummary {
  if (!Array.isArray(summary) || summary.length === 0) return {};
  return summary.reduce<ConsumptionSummary>(
    (acc, s) => {
      Object.keys(s).forEach((k) => {
        acc[k] = s[k];
      });
      return acc;
    },
    {} as ConsumptionSummary,
  );
}

/** Calculate effective progress (0–100) from player telemetry summary. */
export function calculateContentProgress(
  summary: ConsumptionSummary[],
  mimeType: string,
): number {
  if (!Array.isArray(summary) || summary.length === 0) return 0;

  const summaryMap = mergeSummary(summary);
  if (summaryMap.progress === undefined || summaryMap.progress === null) return 0;

  const progressNumRaw = Number(summaryMap.progress);
  const progressNum = Number.isNaN(progressNumRaw) ? 0 : progressNumRaw;
  const visitedLength = Number(summaryMap.visitedLength ?? summaryMap.visitedlength ?? 0);
  const totalLength = Number(summaryMap.totalLength ?? summaryMap.totallength ?? 0);
  const endPageSeen = Boolean(summaryMap.endpageseen);
  const visitedContentEnd = Boolean(summaryMap.visitedcontentend);

  const lowerMime = (mimeType ?? '').toLowerCase();
  if (PLAYBACK_MIME_TYPES.indexOf(lowerMime) > -1) {
    return calculatePlaybackProgress(
      progressNum,
      visitedLength,
      totalLength,
      endPageSeen,
      visitedContentEnd,
    );
  }

  if (OTHER_MIME_TYPES.indexOf(lowerMime) > -1) {
    return absoluteProgress(progressNum, 0);
  }

  // QuML/ECML assessments — must reach 100 progress to complete
  return absoluteProgress(progressNum, 100);
}

/** Map effective progress (0–100) to content state: 0 = not started, 1 = in progress, 2 = completed. */
export function progressToStatus(effectiveProgress: number): 0 | 1 | 2 {
  if (effectiveProgress >= 100) return 2;
  if (effectiveProgress > 0) return 1;
  return 0;
}
