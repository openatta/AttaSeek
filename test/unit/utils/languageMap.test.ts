/**
 * languageMap coverage test — verifies all 60+ extensions map
 * to non-plaintext languages, and filename-based inference works.
 */

import { describe, it, expect } from 'vitest'
import { languageFromPath, languageFromFilename, EXT_TO_LANGUAGE } from '../../../src/renderer/utils/languageMap'
import { EXT_TO_MIME } from '../../../src/shared/types/mime'

describe('languageMap', () => {
  // ── All extensions should return a valid language ──
  it('has 40+ extension mappings', () => {
    expect(Object.keys(EXT_TO_LANGUAGE).length).toBeGreaterThan(40)
  })

  it('no extension maps to undefined or empty string', () => {
    for (const [ext, lang] of Object.entries(EXT_TO_LANGUAGE)) {
      expect(lang, `ext .${ext} maps to "${lang}"`).toBeTruthy()
      expect(typeof lang).toBe('string')
      expect(lang.length).toBeGreaterThan(0)
    }
  })

  // ── Programming languages ──
  const programmingCases: [string, string][] = [
    ['app.ts', 'typescript'], ['Component.tsx', 'typescript'],
    ['main.js', 'javascript'], ['App.jsx', 'javascript'], ['lib.mjs', 'javascript'], ['config.cjs', 'javascript'],
    ['main.py', 'python'], ['window.pyw', 'python'], ['stub.pyi', 'python'],
    ['lib.rs', 'rust'], ['main.go', 'go'],
    ['Main.java', 'java'], ['Util.kt', 'kotlin'], ['script.kts', 'kotlin'], ['App.scala', 'scala'],
    ['main.c', 'c'], ['main.cpp', 'cpp'], ['main.cc', 'cpp'], ['main.cxx', 'cpp'],
    ['header.h', 'c'], ['header.hpp', 'cpp'],
    ['App.cs', 'csharp'], ['Main.swift', 'swift'], ['main.dart', 'dart'],
    ['app.rb', 'ruby'], ['index.php', 'php'], ['init.lua', 'lua'], ['analysis.r', 'r'],
  ]

  for (const [file, expected] of programmingCases) {
    it(`maps ${file} → ${expected}`, () => {
      expect(languageFromPath(file)).toBe(expected)
    })
  }

  // ── Config/data formats ──
  const configCases: [string, string][] = [
    ['data.json', 'json'], ['tsconfig.jsonc', 'json'],
    ['config.yaml', 'yaml'], ['docker-compose.yml', 'yaml'],
    ['Cargo.toml', 'ini'], ['config.ini', 'ini'], ['app.cfg', 'ini'], ['.env', 'ini'],
    ['data.xml', 'xml'], ['icon.svg', 'xml'],
    ['style.css', 'css'], ['theme.scss', 'scss'], ['app.less', 'less'],
    ['page.html', 'html'], ['page.htm', 'html'],
    ['README.md', 'markdown'], ['page.mdx', 'markdown'],
    ['changes.diff', 'diff'], ['fix.patch', 'diff'],
  ]

  for (const [file, expected] of configCases) {
    it(`maps ${file} → ${expected}`, () => {
      expect(languageFromPath(file)).toBe(expected)
    })
  }

  // ── Shell / SQL ──
  it('maps shell scripts', () => {
    expect(languageFromPath('run.sh')).toBe('shell')
    expect(languageFromPath('setup.bash')).toBe('shell')
    expect(languageFromPath('env.zsh')).toBe('shell')
    expect(languageFromPath('config.fish')).toBe('shell')
  })

  it('maps SQL files', () => {
    expect(languageFromPath('query.sql')).toBe('sql')
  })

  // ── Plaintext fallbacks ──
  it('returns plaintext for unknown extensions', () => {
    expect(languageFromPath('data.xyzunknown')).toBe('plaintext')
    expect(languageFromPath('noextension')).toBe('plaintext')
  })

  it('returns plaintext for text/log/csv', () => {
    expect(languageFromPath('readme.txt')).toBe('plaintext')
    expect(languageFromPath('server.log')).toBe('plaintext')
    expect(languageFromPath('data.csv')).toBe('plaintext')
  })

  // ── Filename-based inference ──
  it('detects Dockerfile without extension', () => {
    expect(languageFromPath('Dockerfile')).toBe('dockerfile')
    expect(languageFromPath('dockerfile')).toBe('dockerfile')
  })

  it('detects Makefile without extension', () => {
    expect(languageFromPath('Makefile')).toBe('makefile')
    expect(languageFromPath('makefile')).toBe('makefile')
  })

  it('detects Vagrantfile → ruby', () => {
    expect(languageFromPath('Vagrantfile')).toBe('ruby')
  })

  it('detects Gemfile → ruby', () => {
    expect(languageFromPath('Gemfile')).toBe('ruby')
  })

  it('detects LICENSE → plaintext', () => {
    expect(languageFromPath('LICENSE')).toBe('plaintext')
  })

  // ── languageFromFilename standalone ──
  it('languageFromFilename returns undefined for unknown filenames', () => {
    expect(languageFromFilename('unknownfile')).toBeUndefined()
  })

  it('languageFromFilename is case-insensitive', () => {
    expect(languageFromFilename('DOCKERFILE')).toBe('dockerfile')
    expect(languageFromFilename('MakeFile')).toBe('makefile')
  })

  // ── Edge cases ──
  it('handles paths with no dots', () => {
    expect(languageFromPath('/src/Makefile')).toBe('makefile')
    expect(languageFromPath('/src/Dockerfile')).toBe('dockerfile')
  })

  it('handles hidden files (starting with dot)', () => {
    expect(languageFromPath('.env')).toBe('ini')
    expect(languageFromPath('.bashrc')).toBe('plaintext')
  })

  it('handles deeply nested paths', () => {
    expect(languageFromPath('/a/b/c/d/e/src/utils.ts')).toBe('typescript')
  })

  // ── Cross-module validation ──
  it('covers all text extensions present in mime.ts', () => {
    // Binary/image extensions in mime.ts that intentionally have no language mapping
    const BINARY_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'pdf'])
    // Pseudo-extensions in languageMap from filename detection (not real extensions)
    const FILENAME_ONLY = new Set(['dockerfile', 'makefile'])

    const mimeExts = new Set(Object.keys(EXT_TO_MIME).map((e: string) => e.slice(1))) // strip leading '.'
    const langExts = new Set(Object.keys(EXT_TO_LANGUAGE))

    for (const ext of mimeExts) {
      if (BINARY_EXTS.has(ext)) continue
      if (FILENAME_ONLY.has(ext)) continue
      if (!langExts.has(ext)) {
        // New text extension in mime.ts without a languageMap entry — add it
        throw new Error(`mime.ts extension ".${ext}" has no matching entry in languageMap.ts EXT_TO_LANGUAGE`)
      }
    }
  })
})
