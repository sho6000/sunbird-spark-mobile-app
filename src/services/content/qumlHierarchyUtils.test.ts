import { describe, it, expect } from 'vitest';
import {
  collectQuestionIds,
  replaceQuestionsInHierarchy,
  ensureMaxScore,
  QUESTION_MIME,
  QUESTIONSET_MIME,
} from './qumlHierarchyUtils';

describe('collectQuestionIds', () => {
  it('returns [] for null/empty nodes', () => {
    expect(collectQuestionIds(null)).toEqual([]);
    expect(collectQuestionIds({})).toEqual([]);
  });

  it('collects question identifiers across nested children, in order', () => {
    const tree = {
      mimeType: QUESTIONSET_MIME,
      identifier: 'qs_root',
      children: [
        { mimeType: QUESTION_MIME, identifier: 'q1' },
        {
          mimeType: QUESTIONSET_MIME,
          identifier: 'section',
          children: [
            { mimeType: QUESTION_MIME, identifier: 'q2' },
            { mimeType: QUESTION_MIME, identifier: 'q3' },
          ],
        },
      ],
    };
    expect(collectQuestionIds(tree)).toEqual(['q1', 'q2', 'q3']);
  });

  it('ignores question nodes without an identifier', () => {
    const tree = {
      mimeType: QUESTIONSET_MIME,
      children: [{ mimeType: QUESTION_MIME }],
    };
    expect(collectQuestionIds(tree)).toEqual([]);
  });
});

describe('replaceQuestionsInHierarchy', () => {
  it('replaces question stubs with full objects from the map', () => {
    const map = new Map<string, any>([['q1', { identifier: 'q1', body: '<p>full</p>' }]]);
    const tree = {
      mimeType: QUESTIONSET_MIME,
      children: [{ mimeType: QUESTION_MIME, identifier: 'q1' }],
    };
    const result = replaceQuestionsInHierarchy(tree, map);
    expect(result.children[0]).toEqual({ identifier: 'q1', body: '<p>full</p>' });
  });

  it('keeps the existing node when the question is not in the map', () => {
    const stub = { mimeType: QUESTION_MIME, identifier: 'q9' };
    const tree = { mimeType: QUESTIONSET_MIME, children: [stub] };
    const result = replaceQuestionsInHierarchy(tree, new Map());
    expect(result.children[0]).toBe(stub);
  });
});

describe('ensureMaxScore', () => {
  it('adds outcomeDeclaration.maxScore when missing', () => {
    const result = ensureMaxScore({ maxScore: 3 });
    expect(result.outcomeDeclaration.maxScore).toEqual({
      cardinality: 'single',
      type: 'integer',
      defaultValue: 3,
    });
  });

  it('defaults maxScore to 1 when no maxScore field is present', () => {
    const result = ensureMaxScore({});
    expect(result.outcomeDeclaration.maxScore.defaultValue).toBe(1);
  });

  it('leaves an existing outcomeDeclaration.maxScore untouched', () => {
    const existing = { cardinality: 'single', type: 'integer', defaultValue: 9 };
    const result = ensureMaxScore({ outcomeDeclaration: { maxScore: existing } });
    expect(result.outcomeDeclaration.maxScore).toBe(existing);
  });

  it('normalises a stringified outcomeDeclaration into an object (no throw)', () => {
    const metadata = {
      outcomeDeclaration: JSON.stringify({ maxScore: { defaultValue: 5 } }),
    };
    const result = ensureMaxScore(metadata);
    expect(typeof result.outcomeDeclaration).toBe('object');
    expect(result.outcomeDeclaration.maxScore.defaultValue).toBe(5);
  });

  it('recovers to an object when outcomeDeclaration is an unparseable string', () => {
    const result = ensureMaxScore({ outcomeDeclaration: 'not json', maxScore: 2 });
    expect(typeof result.outcomeDeclaration).toBe('object');
    expect(result.outcomeDeclaration.maxScore.defaultValue).toBe(2);
  });
});
