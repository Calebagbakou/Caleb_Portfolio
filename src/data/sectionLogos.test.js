import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSectionLogoSettings, SECTION_ICON_GROUPS } from './sectionLogos.js';

test('reads default and custom icons for known public sections', () => {
  const logos = parseSectionLogoSettings(JSON.stringify({
    'service-content-ai': { url: 'https://cdn.example.com/service.png', mode: 'custom' },
    'contact-email': { url: '', mode: 'default' },
    unknown: { url: 'https://cdn.example.com/ignored.png', mode: 'custom' },
  }));

  assert.deepEqual(logos, {
    'service-content-ai': { url: 'https://cdn.example.com/service.png', mode: 'custom' },
    'contact-email': { url: '', mode: 'default' },
  });
  assert.ok(SECTION_ICON_GROUPS.length >= 3);
});

test('rejects invalid section icon settings', () => {
  assert.throws(() => parseSectionLogoSettings('[]'), /objet JSON/);
  assert.throws(() => parseSectionLogoSettings(JSON.stringify({
    'service-content-ai': { url: '', mode: 'uploaded' },
  })), /service-content-ai/);
});
