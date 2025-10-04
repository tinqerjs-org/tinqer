#!/usr/bin/env bash
set -euo pipefail

# Generate llms.txt from all documentation files
# This creates a single file that contains all documentation for LLM context

OUTPUT_FILE="llms.txt"

echo "Generating ${OUTPUT_FILE} from documentation files..."

# Start with header
cat > "${OUTPUT_FILE}" << 'HEADER'
# Tinqer Documentation

This file contains the complete documentation for Tinqer, a runtime LINQ-to-SQL query builder for TypeScript.

---

HEADER

# Add README.md
echo "## README" >> "${OUTPUT_FILE}"
echo "" >> "${OUTPUT_FILE}"
cat README.md >> "${OUTPUT_FILE}"
echo "" >> "${OUTPUT_FILE}"
echo "---" >> "${OUTPUT_FILE}"
echo "" >> "${OUTPUT_FILE}"

# Add all docs files
for doc_file in docs/*.md; do
  # Extract filename without path and extension
  filename=$(basename "${doc_file}" .md)
  
  # Convert filename to title (e.g., api-reference -> API Reference)
  title=$(echo "${filename}" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
  
  echo "Adding ${doc_file}..."
  
  echo "## ${title}" >> "${OUTPUT_FILE}"
  echo "" >> "${OUTPUT_FILE}"
  
  # Remove the "Back to README" links from doc files
  sed '/\[← Back to README\]/d' "${doc_file}" >> "${OUTPUT_FILE}"
  
  echo "" >> "${OUTPUT_FILE}"
  echo "---" >> "${OUTPUT_FILE}"
  echo "" >> "${OUTPUT_FILE}"
done

echo "✓ Generated ${OUTPUT_FILE} successfully"
echo "  File size: $(wc -c < "${OUTPUT_FILE}") bytes"
echo "  Line count: $(wc -l < "${OUTPUT_FILE}") lines"
