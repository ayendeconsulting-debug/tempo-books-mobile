import { apiClient } from './api';

export interface DocumentRecord {
  id: string;
  business_id: string;
  raw_transaction_id: string | null;
  journal_entry_id: string | null;
  s3_key: string;
  s3_bucket: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  extract_result: ExtractResult | null;
  extract_status: 'pending' | 'processing' | 'complete' | 'failed' | null;
  created_at: string;
}

export interface ExtractResult {
  vendor: string | null;
  amount: number | null;
  date: string | null;
  currency: string | null;
  confidence: number;
}

export interface PresignedUploadResponse {
  url: string;
  key: string;
  bucket: string;
}

export interface ExtractJobResponse {
  job_id: string;
}

export interface ExtractJobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  result?: ExtractResult;
  error?: string;
}

// ── Document API ─────────────────────────────────────────────────────

export async function getDocumentsForTransaction(rawTransactionId: string): Promise<DocumentRecord[]> {
  const res = await apiClient.get(`/documents?rawTransactionId=${rawTransactionId}`);
  return res.data as DocumentRecord[];
}

export async function requestPresignedUpload(opts: {
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  rawTransactionId: string;
}): Promise<PresignedUploadResponse> {
  const res = await apiClient.post('/documents/upload', {
    file_name: opts.fileName,
    file_type: opts.fileType,
    file_size_bytes: opts.fileSizeBytes,
    raw_transaction_id: opts.rawTransactionId,
  });
  return res.data as PresignedUploadResponse;
}

export async function registerDocument(opts: {
  s3Key: string;
  s3Bucket: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  rawTransactionId: string;
}): Promise<DocumentRecord> {
  const res = await apiClient.post('/documents', {
    s3_key: opts.s3Key,
    s3_bucket: opts.s3Bucket,
    file_name: opts.fileName,
    file_type: opts.fileType,
    file_size_bytes: opts.fileSizeBytes,
    raw_transaction_id: opts.rawTransactionId,
  });
  return res.data as DocumentRecord;
}

// ── AI Extract API ───────────────────────────────────────────────────

export async function startReceiptExtract(documentId: string): Promise<ExtractJobResponse> {
  const res = await apiClient.post(`/ai/receipt-extract/${documentId}`);
  return res.data as ExtractJobResponse;
}

export async function getExtractJobStatus(jobId: string): Promise<ExtractJobStatus> {
  const res = await apiClient.get(`/ai/jobs/${jobId}`);
  return res.data as ExtractJobStatus;
}

/**
 * Poll an extract job until it reaches a terminal state.
 * Resolves with the final job status. Rejects on timeout or HTTP error.
 *
 * @param jobId      Job to poll
 * @param intervalMs Poll interval (default 2000 per FR-32b-3)
 * @param timeoutMs  Maximum wait (default 60000 per NFR-32b-1)
 */
export function pollExtractJob(
  jobId: string,
  intervalMs = 2000,
  timeoutMs = 60000,
): Promise<ExtractJobStatus> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      try {
        const status = await getExtractJobStatus(jobId);
        if (status.status === 'complete' || status.status === 'failed') {
          resolve(status);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Extract job timed out'));
          return;
        }
        setTimeout(tick, intervalMs);
      } catch (err) {
        reject(err);
      }
    };
    tick();
  });
}
// Document deletion

export async function deleteDocument(documentId: string): Promise<void> {
  await apiClient.delete(`/documents/${documentId}`);
}
