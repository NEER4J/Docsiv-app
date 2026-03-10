'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { uploadDocumentAttachment } from '@/lib/storage/upload';
import { useDocumentUploadContext } from '@/components/platejs/editors/document-upload-context';

export type DocumentUploadedFile = {
  url: string;
  name: string;
  size: number;
  type: string;
};

export function useDocumentAttachmentUpload() {
  const ctx = useDocumentUploadContext();
  const [uploadedFile, setUploadedFile] = React.useState<DocumentUploadedFile | undefined>();
  const [uploadingFile, setUploadingFile] = React.useState<File | undefined>();
  const [progress, setProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);

  const uploadFile = React.useCallback(
    async (file: File): Promise<DocumentUploadedFile | undefined> => {
      if (!ctx) return undefined;
      setIsUploading(true);
      setUploadingFile(file);
      setProgress(0);

      try {
        setProgress(30);
        const result = await uploadDocumentAttachment(ctx.workspaceId, ctx.documentId, file);
        setProgress(100);

        if ('error' in result) {
          toast.error(result.error);
          return undefined;
        }

        const out: DocumentUploadedFile = {
          url: result.url,
          name: result.name,
          size: file.size,
          type: file.type,
        };
        setUploadedFile(out);
        return out;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
        return undefined;
      } finally {
        setProgress(0);
        setIsUploading(false);
        setUploadingFile(undefined);
      }
    },
    [ctx]
  );

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile,
    uploadingFile,
  };
}
