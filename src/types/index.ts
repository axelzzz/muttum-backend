export interface Definition {
  partOfSpeech: string;
  definition: string;
  example: string | null;
}

export interface UserWordDto {
  id: string;
  word: string;
  definitions: Definition[];
  firstSearchedAt: Date;
  lastSearchedAt: Date;
  searchCount: number;
  notes: string;
  tags: string[];
  favorite: boolean;
}

export interface SearchResult extends UserWordDto {
  wordId: string;
  source: string;
  fromCache: boolean;
  alreadyInList: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface UserWordList {
  items: UserWordDto[];
  pagination: Pagination;
}

export interface UserDto {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
}

export type DictionaryErrorCode = 'NOT_FOUND' | 'UPSTREAM_ERROR' | 'INVALID_INPUT';
