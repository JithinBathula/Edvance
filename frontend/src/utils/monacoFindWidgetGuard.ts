export const MONACO_FIND_WIDGET_OPEN_CLASS = 'edvance-monaco-find-widget-open';

const ACTIVE_FIND_WIDGET_COUNT_ATTR = 'data-edvance-monaco-find-widget-count';

const getActiveFindWidgetCount = (bodyEl: HTMLElement) => {
  const raw = bodyEl.getAttribute(ACTIVE_FIND_WIDGET_COUNT_ATTR);
  return raw ? Number.parseInt(raw, 10) || 0 : 0;
};

const setActiveFindWidgetCount = (bodyEl: HTMLElement, count: number) => {
  if (count <= 0) {
    bodyEl.removeAttribute(ACTIVE_FIND_WIDGET_COUNT_ATTR);
    bodyEl.classList.remove(MONACO_FIND_WIDGET_OPEN_CLASS);
    return;
  }

  bodyEl.setAttribute(ACTIVE_FIND_WIDGET_COUNT_ATTR, String(count));
  bodyEl.classList.add(MONACO_FIND_WIDGET_OPEN_CLASS);
};

/**
 * Tracks Monaco find-widget visibility for a single editor and toggles a shared
 * body class only while at least one editor has the find widget open.
 */
export const attachMonacoFindWidgetGuard = (
  editorDomNode: HTMLElement,
  bodyEl: HTMLElement = document.body
) => {
  let isFindWidgetVisible = false;

  const syncFindWidgetState = () => {
    const nextVisible = Boolean(editorDomNode.querySelector('.find-widget.visible'));
    if (nextVisible === isFindWidgetVisible) return;

    isFindWidgetVisible = nextVisible;
    const currentCount = getActiveFindWidgetCount(bodyEl);
    setActiveFindWidgetCount(bodyEl, currentCount + (nextVisible ? 1 : -1));
  };

  const observer = new MutationObserver(syncFindWidgetState);
  observer.observe(editorDomNode, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  syncFindWidgetState();

  return () => {
    observer.disconnect();
    if (!isFindWidgetVisible) return;

    isFindWidgetVisible = false;
    setActiveFindWidgetCount(bodyEl, getActiveFindWidgetCount(bodyEl) - 1);
  };
};
