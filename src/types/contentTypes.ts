export type SearchMode = 'keyword' | 'semantic';

export interface SemanticConfig {
  k: number;
  min_score: number;
}

export interface ContentSearchRequest {
  filters?: Record<string, unknown>;
  facets?: string[];
  limit?: number;
  offset?: number;
  query?: string;
  sort_by?: Record<string, string>;
  /** Vector search tuning; defaults to { k: 50, min_score: 0.6 }. */
  semantic?: SemanticConfig;
}

export interface ContentSearchItem {
  identifier: string;
  name?: string;
  description?: string;
  objectType?: string;
  status?: string;
  thumbnail?: string;
  posterImage?: string;
  createdOn?: string;
  lastUpdatedOn?: string;
  creator?: string;
  createdBy?: string;
  mimeType?: string;
  appIcon?: string;
  primaryCategory?: string;
  contentType?: string;
  framework?: string;
  leafNodesCount?: number;
  visibility?: string;
  parent?: string;
}

export interface RelatedContentItem {
  identifier: string;
  name: string;
  appIcon: string;
  posterImage: string;
  mimeType?: string;
  primaryCategory?: string;
  cardType: 'collection' | 'resource';
  leafNodesCount?: number;
  creator: string;
}

export interface ContentSearchResponse {
  count?: number;
  content?: ContentSearchItem[];
  QuestionSet?: ContentSearchItem[];
}

export interface UseContentSearchOptions {
  request?: ContentSearchRequest;
  enabled?: boolean;
  searchMode?: SearchMode;
}
