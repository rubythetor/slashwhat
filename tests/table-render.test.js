import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/js/views/table-render.js';

describe('escapeHtml', () => {
  it('escapes angle brackets in script tags', () => {
    assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  });

  it('escapes double quotes to prevent attribute injection', () => {
    assert.equal(
      escapeHtml('"onmouseover="alert(1)"'),
      '&quot;onmouseover=&quot;alert(1)&quot;'
    );
  });

  it('escapes ampersands', () => {
    assert.equal(escapeHtml('A & B'), 'A &amp; B');
  });

  it('returns empty string unchanged', () => {
    assert.equal(escapeHtml(''), '');
  });

  it('passes through strings with no special chars', () => {
    assert.equal(escapeHtml('hello world'), 'hello world');
  });

  it('escapes all entities in a combined string', () => {
    assert.equal(
      escapeHtml('<a href="x">&'),
      '&lt;a href=&quot;x&quot;&gt;&amp;'
    );
  });

  it('preserves unicode characters unchanged', () => {
    assert.equal(escapeHtml('\u3053\u3093\u306B\u3061\u306F'), '\u3053\u3093\u306B\u3061\u306F');
  });

  it('does not double-encode HTML entity references', () => {
    // &#x3C; contains & and ; — the & gets encoded but ; does not.
    const result = escapeHtml('&#x3C;script&#x3E;');
    assert.equal(result, '&amp;#x3C;script&amp;#x3E;');
  });

  it('escapes multiple ampersands in a row', () => {
    assert.equal(escapeHtml('&&'), '&amp;&amp;');
  });

  it('escapes mixed content with numbers and special chars', () => {
    assert.equal(escapeHtml('x < 5 & y > 3'), 'x &lt; 5 &amp; y &gt; 3');
  });
});
