import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractYouTubeVideoId,
  getYouTubeEmbedUrl,
  getYouTubePreviewUrl,
  normalizeYouTubeUrl,
} from './projectMedia.js';

const videoId = 'dQw4w9WgXcQ';

test('extracts YouTube IDs from common watch, short, and Shorts URLs', () => {
  assert.equal(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${videoId}`), videoId);
  assert.equal(extractYouTubeVideoId(`https://youtu.be/${videoId}?si=abc`), videoId);
  assert.equal(extractYouTubeVideoId(`https://youtube.com/shorts/${videoId}`), videoId);
  assert.equal(extractYouTubeVideoId(`https://m.youtube.com/live/${videoId}`), videoId);
});

test('rejects invalid or non-YouTube URLs and produces safe normalized URLs', () => {
  assert.equal(extractYouTubeVideoId('not a URL'), null);
  assert.equal(extractYouTubeVideoId('https://youtube.com.evil.example/watch?v=' + videoId), null);
  assert.equal(extractYouTubeVideoId('https://youtube.com/watch?v=short'), null);
  assert.equal(normalizeYouTubeUrl(`https://youtu.be/${videoId}`), `https://www.youtube.com/watch?v=${videoId}`);
  const embed = new URL(getYouTubeEmbedUrl(`https://youtube.com/shorts/${videoId}`));
  assert.equal(embed.origin, 'https://www.youtube.com');
  assert.equal(embed.pathname, `/embed/${videoId}`);
  assert.equal(embed.searchParams.get('autoplay'), '1');
  assert.equal(embed.searchParams.get('playsinline'), '1');
  assert.equal(embed.searchParams.get('enablejsapi'), '1');
  assert.equal(embed.searchParams.get('controls'), '1');

  const preview = new URL(getYouTubePreviewUrl(`https://youtu.be/${videoId}`));
  assert.equal(preview.searchParams.get('autoplay'), '0');
  assert.equal(preview.searchParams.has('mute'), false);
  assert.equal(preview.searchParams.get('controls'), '0');
  assert.equal(preview.searchParams.get('enablejsapi'), '1');
});
