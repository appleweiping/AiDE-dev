// RAG (Retrieval-Augmented Generation) module
export { ProjectIndexer, indexProject, searchIndex } from './indexer.js';
export type { IndexOptions, IndexStats, SearchResult } from './indexer.js';

export { chunkFile, detectLanguage } from './chunker.js';
export type { Chunk, ChunkOptions } from './chunker.js';

export {
  createIndex,
  addDocument,
  removeDocument,
  search as tfidfSearch,
  tokenise,
  serializeIndex,
  deserializeIndex,
} from './tfidf.js';
export type {
  TfIdfDocument,
  TfIdfIndex,
  SearchHit,
  SerializedIndex,
} from './tfidf.js';
