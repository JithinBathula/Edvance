import { afterEach, describe, expect, it } from 'vitest';
import {
  attachMonacoFindWidgetGuard,
  MONACO_FIND_WIDGET_OPEN_CLASS,
} from '../utils/monacoFindWidgetGuard';

const flushMutationObserver = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

afterEach(() => {
  document.body.classList.remove(MONACO_FIND_WIDGET_OPEN_CLASS);
  document.body.removeAttribute('data-edvance-monaco-find-widget-count');
  document.body.innerHTML = '';
});

describe('attachMonacoFindWidgetGuard', () => {
  it('adds and removes the body class as the find widget opens and closes', async () => {
    const editorDomNode = document.createElement('div');
    const findWidget = document.createElement('div');
    findWidget.className = 'find-widget';
    editorDomNode.appendChild(findWidget);
    document.body.appendChild(editorDomNode);

    const cleanup = attachMonacoFindWidgetGuard(editorDomNode, document.body);

    expect(document.body.classList.contains(MONACO_FIND_WIDGET_OPEN_CLASS)).toBe(false);

    findWidget.className = 'find-widget visible';
    await flushMutationObserver();

    expect(document.body.classList.contains(MONACO_FIND_WIDGET_OPEN_CLASS)).toBe(true);
    expect(document.body.getAttribute('data-edvance-monaco-find-widget-count')).toBe('1');

    findWidget.className = 'find-widget';
    await flushMutationObserver();

    expect(document.body.classList.contains(MONACO_FIND_WIDGET_OPEN_CLASS)).toBe(false);
    expect(document.body.hasAttribute('data-edvance-monaco-find-widget-count')).toBe(false);

    cleanup();
  });

  it('cleans up an active editor without leaving the body class behind', async () => {
    const editorDomNode = document.createElement('div');
    editorDomNode.innerHTML = '<div class="find-widget visible"></div>';
    document.body.appendChild(editorDomNode);

    const cleanup = attachMonacoFindWidgetGuard(editorDomNode, document.body);
    await flushMutationObserver();

    expect(document.body.classList.contains(MONACO_FIND_WIDGET_OPEN_CLASS)).toBe(true);

    cleanup();

    expect(document.body.classList.contains(MONACO_FIND_WIDGET_OPEN_CLASS)).toBe(false);
    expect(document.body.hasAttribute('data-edvance-monaco-find-widget-count')).toBe(false);
  });

  it('keeps the body class while another editor still has find open', async () => {
    const firstEditorDomNode = document.createElement('div');
    const secondEditorDomNode = document.createElement('div');
    firstEditorDomNode.innerHTML = '<div class="find-widget visible"></div>';
    secondEditorDomNode.innerHTML = '<div class="find-widget"></div>';
    document.body.appendChild(firstEditorDomNode);
    document.body.appendChild(secondEditorDomNode);

    const firstCleanup = attachMonacoFindWidgetGuard(firstEditorDomNode, document.body);
    const secondCleanup = attachMonacoFindWidgetGuard(secondEditorDomNode, document.body);
    await flushMutationObserver();

    const secondFindWidget = secondEditorDomNode.querySelector('.find-widget');
    if (!secondFindWidget) throw new Error('Expected second find widget');

    secondFindWidget.className = 'find-widget visible';
    await flushMutationObserver();

    expect(document.body.getAttribute('data-edvance-monaco-find-widget-count')).toBe('2');

    firstCleanup();

    expect(document.body.classList.contains(MONACO_FIND_WIDGET_OPEN_CLASS)).toBe(true);
    expect(document.body.getAttribute('data-edvance-monaco-find-widget-count')).toBe('1');

    secondCleanup();

    expect(document.body.classList.contains(MONACO_FIND_WIDGET_OPEN_CLASS)).toBe(false);
    expect(document.body.hasAttribute('data-edvance-monaco-find-widget-count')).toBe(false);
  });
});
