import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { questionSetService } from '../services/QuestionSetService';
import { loadLocalQumlContent } from '../services/content/localQumlLoader';
import {
  collectQuestionIds,
  replaceQuestionsInHierarchy,
  ensureMaxScore,
} from '../services/content/qumlHierarchyUtils';
import _ from 'lodash';

interface UseQumlContentOptions {
  enabled?: boolean;
}

/**
 * Fetches and processes QUML content data for the QuML player.
 *
 * Local-first: if the questionset has been downloaded for offline use, the
 * merged hierarchy is rebuilt from the stored ecar files (works with no
 * network). Otherwise it falls back to the API:
 * - Fetches hierarchy from /questionset/v2/hierarchy/:id
 * - Collects question IDs from the hierarchy
 * - Fetches full question data from /question/v2/list
 * - Merges full question data into the hierarchy
 * - Ensures outcomeDeclaration.maxScore exists
 */
export const useQumlContent = (
  questionSetId: string,
  options?: UseQumlContentOptions
): UseQueryResult<any, Error> => {
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ['quml', 'questionset', questionSetId],
    enabled: enabled && Boolean(questionSetId),
    // staleTime 0 so the queryFn re-runs on every mount. This is essential for the
    // local-first behaviour: a questionset opened while online caches the API
    // hierarchy (CDN image URLs); without re-running we'd serve that stale cache
    // offline and every image would 404. Re-running lets loadLocalQumlContent win
    // for downloaded content (it sources images from disk).
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    // Run the queryFn even when offline: downloaded questionsets load from disk.
    networkMode: 'always',
    queryFn: async () => {
      // Local-first: if downloaded, rebuild the merged hierarchy from stored files.
      const local = await loadLocalQumlContent(questionSetId);
      if (local) {
        return local;
      }

      const hierarchyResp = await questionSetService.getHierarchy<any>(questionSetId);

      let metadata = _.get(hierarchyResp, 'data.questionset') || _.get(hierarchyResp, 'data.questionSet');

      if (!metadata) {
        throw new Error(`Hierarchy payload missing questionset for ID: ${questionSetId}`);
      }

      const questionIds = collectQuestionIds(metadata);

      // Fetch full question data (with body, responseDeclaration, interactions, etc.)
      const questionMap = new Map<string, any>();
      if (!_.isEmpty(questionIds)) {
        const listResp = await questionSetService.getQuestionList<any>(questionIds);
        const questions = _.get(listResp, 'data.questions') || _.get(listResp, 'data.result.questions', []);

        questions.forEach((q: any) => {
          const identifier = _.get(q, 'identifier');
          if (identifier) {
            questionMap.set(identifier, q);
          }
        });
      }

      // Replace question stubs in hierarchy with full question data
      metadata = replaceQuestionsInHierarchy(metadata, questionMap);

      // Ensure outcomeDeclaration.maxScore structure exists
      metadata = ensureMaxScore(metadata);

      return metadata;
    },
  });
};
