import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractYouTubeVideoId,
  getYouTubeEmbedUrl,
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
  assert.equal(getYouTubeEmbedUrl(`https://youtube.com/shorts/${videoId}`), `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`);
});
