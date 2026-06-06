/**
 * Writing agent tools — manifests for document creation and editing.
 */

import type { ToolManifest } from '../../../../shared/types/Tool'

// Writing-specific tool manifests. Core document tools (create_document, review_document,
// format_document, outline_document) are registered via demo-tools + document-tools.
// This array holds only writing-domain-specific tools not covered elsewhere.
export const WRITING_TOOLS: ToolManifest[] = []
