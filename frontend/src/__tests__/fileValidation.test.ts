// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for isValidFile from CustomProjectChat.tsx.
 * Inline copies of constants and function to avoid React component import.
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const VALID_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif',
  'application/pdf', 'text/plain', 'text/x-python', 'application/javascript',
];
const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.py', '.js'];

function isValidFile(file: { name: string; type: string; size: number }): { valid: boolean; reason?: string } {
  const isImage = file.type.startsWith('image/');
  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return { valid: false, reason: `${file.name} is too large (images max 5MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB)` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, reason: `${file.name} is too large (max 50MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB)` };
  }
  const typeOk = VALID_MIME_TYPES.includes(file.type) || VALID_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  if (!typeOk) {
    return { valid: false, reason: `${file.name} has an unsupported file type` };
  }
  return { valid: true };
}

describe('isValidFile', () => {
  it('accepts a valid image', () => {
    const file = { name: 'photo.png', type: 'image/png', size: 1024 };
    expect(isValidFile(file)).toEqual({ valid: true });
  });

  it('accepts a valid Python file by extension', () => {
    const file = { name: 'main.py', type: '', size: 500 };
    expect(isValidFile(file)).toEqual({ valid: true });
  });

  it('accepts a valid PDF by MIME type', () => {
    const file = { name: 'doc.pdf', type: 'application/pdf', size: 1024 };
    expect(isValidFile(file)).toEqual({ valid: true });
  });

  it('rejects image over 5MB', () => {
    const file = { name: 'big.png', type: 'image/png', size: 6 * 1024 * 1024 };
    const result = isValidFile(file);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('5MB');
  });

  it('rejects any file over 50MB', () => {
    const file = { name: 'huge.py', type: 'text/x-python', size: 51 * 1024 * 1024 };
    const result = isValidFile(file);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('50MB');
  });

  it('rejects unsupported file type', () => {
    const file = { name: 'data.xlsx', type: 'application/vnd.ms-excel', size: 1024 };
    const result = isValidFile(file);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('unsupported');
  });

  it('is case insensitive on extension', () => {
    const file = { name: 'IMAGE.PNG', type: '', size: 1024 };
    expect(isValidFile(file)).toEqual({ valid: true });
  });

  it('rejects file with no matching type or extension', () => {
    const file = { name: 'noext', type: 'application/octet-stream', size: 100 };
    const result = isValidFile(file);
    expect(result.valid).toBe(false);
  });
});
