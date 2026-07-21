import _ from 'lodash';

export const QUESTION_MIME = 'application/vnd.sunbird.question';
export const QUESTIONSET_MIME = 'application/vnd.sunbird.questionset';

/**
 * Recursively collects all question identifiers from a questionset hierarchy tree.
 */
export function collectQuestionIds(node: any): string[] {
  if (!node) return [];
  const currentId =
    node.mimeType === QUESTION_MIME && node.identifier ? [node.identifier] : [];
  const childIds = _.flatMap(_.get(node, 'children', []), collectQuestionIds);
  return [...currentId, ...childIds];
}

/**
 * Replaces question stub nodes in the hierarchy with full question objects
 * (body, responseDeclaration, interactions, etc.) from `questionMap`.
 * If a question isn't in the map, the existing node is kept as-is — so this is
 * safe whether questions arrive separately or are already inlined in the tree.
 */
export function replaceQuestionsInHierarchy(node: any, questionMap: Map<string, any>): any {
  if (!node) return node;

  if (node.mimeType === QUESTION_MIME && node.identifier) {
    return questionMap.get(node.identifier) || node;
  }

  const children = _.get(node, 'children');
  if (Array.isArray(children)) {
    node.children = _.map(children, (child) => replaceQuestionsInHierarchy(child, questionMap));
  }

  return node;
}

/**
 * Ensures the questionset metadata has the outcomeDeclaration.maxScore structure
 * the QuML player expects.
 *
 * `outcomeDeclaration` is sometimes published as a JSON string rather than an
 * object; assigning `.maxScore` onto a string throws in strict mode, so we
 * normalise it to an object (parsing it if it's a string) before writing.
 */
export function ensureMaxScore(metadata: any): any {
  let outcome = _.get(metadata, 'outcomeDeclaration');
  if (typeof outcome === 'string') {
    try {
      outcome = JSON.parse(outcome);
    } catch {
      outcome = {};
    }
    metadata.outcomeDeclaration = outcome;
  }
  if (!outcome || typeof outcome !== 'object') {
    outcome = {};
    metadata.outcomeDeclaration = outcome;
  }
  if (!outcome.maxScore) {
    const maxScore = _.get(metadata, 'maxScore', 1);
    outcome.maxScore = {
      cardinality: 'single',
      type: 'integer',
      defaultValue: maxScore,
    };
  }
  return metadata;
}
