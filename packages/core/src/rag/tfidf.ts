/**
 * TF-IDF implementation for local text similarity search.
 * No external API required — pure in-process computation.
 */

export interface TfIdfDocument {
  id: string;
  terms: Map<string, number>; // term -> raw count
  termCount: number;
}

export interface TfIdfIndex {
  documents: Map<string, TfIdfDocument>;
  /** document frequency: term -> number of docs containing it */
  df: Map<string, number>;
  totalDocs: number;
}

// ---------------------------------------------------------------------------
// Tokenisation
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'not', 'no', 'nor',
  'so', 'yet', 'both', 'either', 'neither', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'than', 'too', 'very', 'just', 'as', 'if',
  'then', 'that', 'this', 'these', 'those', 'it', 'its', 'we', 'our',
  'you', 'your', 'he', 'she', 'they', 'their', 'what', 'which', 'who',
  'return', 'import', 'export', 'const', 'let', 'var', 'function', 'class',
  'new', 'true', 'false', 'null', 'undefined', 'void', 'type', 'interface',
]);

/**
 * Tokenise text into lowercase terms, splitting on non-alphanumeric chars
 * and camelCase/snake_case boundaries.
 */
export function tokenise(text: string): string[] {
  // Split camelCase: fooBar -> foo bar
  const expanded = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  return expanded
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

// ---------------------------------------------------------------------------
// Index construction
// ---------------------------------------------------------------------------

export function createIndex(): TfIdfIndex {
  return { documents: new Map(), df: new Map(), totalDocs: 0 };
}

export function addDocument(index: TfIdfIndex, id: string, text: string): void {
  // Remove old document if it exists (for incremental updates)
  if (index.documents.has(id)) {
    removeDocument(index, id);
  }

  const terms = tokenise(text);
  const termCounts = new Map<string, number>();
  for (const term of terms) {
    termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
  }

  const doc: TfIdfDocument = {
    id,
    terms: termCounts,
    termCount: terms.length,
  };

  index.documents.set(id, doc);
  index.totalDocs++;

  // Update document frequencies
  for (const term of termCounts.keys()) {
    index.df.set(term, (index.df.get(term) ?? 0) + 1);
  }
}

export function removeDocument(index: TfIdfIndex, id: string): void {
  const doc = index.documents.get(id);
  if (!doc) return;

  for (const term of doc.terms.keys()) {
    const freq = index.df.get(term) ?? 0;
    if (freq <= 1) {
      index.df.delete(term);
    } else {
      index.df.set(term, freq - 1);
    }
  }

  index.documents.delete(id);
  index.totalDocs = Math.max(0, index.totalDocs - 1);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute TF-IDF score for a single term in a document.
 * TF = log(1 + count/docLength), IDF = log((N+1)/(df+1)) + 1  (smoothed)
 */
function tfIdf(
  termCount: number,
  docLength: number,
  docFreq: number,
  totalDocs: number,
): number {
  if (docLength === 0) return 0;
  const tf = Math.log(1 + termCount / docLength);
  const idf = Math.log((totalDocs + 1) / (docFreq + 1)) + 1;
  return tf * idf;
}

/**
 * Build a sparse TF-IDF vector for a document.
 */
function buildVector(
  doc: TfIdfDocument,
  index: TfIdfIndex,
): Map<string, number> {
  const vec = new Map<string, number>();
  for (const [term, count] of doc.terms) {
    const df = index.df.get(term) ?? 0;
    vec.set(term, tfIdf(count, doc.termCount, df, index.totalDocs));
  }
  return vec;
}

/**
 * Cosine similarity between two sparse vectors.
 */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, va] of a) {
    normA += va * va;
    const vb = b.get(term);
    if (vb !== undefined) dot += va * vb;
  }
  for (const [, vb] of b) {
    normB += vb * vb;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchHit {
  id: string;
  score: number;
}

/**
 * Search the index for documents most similar to the query.
 * Returns hits sorted by descending score.
 */
export function search(
  index: TfIdfIndex,
  query: string,
  topK = 10,
): SearchHit[] {
  if (index.totalDocs === 0) return [];

  const queryTerms = tokenise(query);
  if (queryTerms.length === 0) return [];

  // Build a pseudo-document for the query
  const queryTermCounts = new Map<string, number>();
  for (const t of queryTerms) {
    queryTermCounts.set(t, (queryTermCounts.get(t) ?? 0) + 1);
  }
  const queryDoc: TfIdfDocument = {
    id: '__query__',
    terms: queryTermCounts,
    termCount: queryTerms.length,
  };
  const queryVec = buildVector(queryDoc, index);

  // Score all documents
  const hits: SearchHit[] = [];
  for (const [id, doc] of index.documents) {
    const docVec = buildVector(doc, index);
    const score = cosineSimilarity(queryVec, docVec);
    if (score > 0) {
      hits.push({ id, score });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

export interface SerializedIndex {
  documents: Array<{ id: string; terms: Array<[string, number]>; termCount: number }>;
  df: Array<[string, number]>;
  totalDocs: number;
}

export function serializeIndex(index: TfIdfIndex): SerializedIndex {
  return {
    documents: Array.from(index.documents.values()).map((d) => ({
      id: d.id,
      terms: Array.from(d.terms.entries()),
      termCount: d.termCount,
    })),
    df: Array.from(index.df.entries()),
    totalDocs: index.totalDocs,
  };
}

export function deserializeIndex(data: SerializedIndex): TfIdfIndex {
  const index = createIndex();
  index.totalDocs = data.totalDocs;
  index.df = new Map(data.df);
  for (const d of data.documents) {
    index.documents.set(d.id, {
      id: d.id,
      terms: new Map(d.terms),
      termCount: d.termCount,
    });
  }
  return index;
}
