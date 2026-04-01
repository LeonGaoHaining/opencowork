/**
 * UIGraph语义图构建器
 * 位置: src/browser/uiGraph.ts
 *
 * 功能: 将DOM转换为语义化元素图谱
 * 核心: 灵活的selector优先级fallback链
 */

import { Page } from 'playwright';
import {
  UIElement,
  UIGraph,
  ElementRole,
  ElementVisibility,
  ObserverConfig,
  DEFAULT_OBSERVER_CONFIG,
} from '../types/uiElement';

interface DOMElement {
  tag: string;
  text: string;
  value: string;
  attributes: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
  parentContext: string;
  index: number;
}

/**
 * 构建页面UIGraph
 */
export async function buildUIGraph(page: Page, config?: Partial<ObserverConfig>): Promise<UIGraph> {
  const fullConfig = { ...DEFAULT_OBSERVER_CONFIG, ...config };

  const domElements = await page.evaluate((cfg) => {
    try {
      const selectors = [
        'button',
        'a',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[role="radio"]',
      ];

      const candidates = document.querySelectorAll(selectors.join(','));
      const results: DOMElement[] = [];

      candidates.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 5 || rect.height < 5) return;

        const attributeNames = [
          'id',
          'name',
          'data-testid',
          'aria-label',
          'aria-labelledby',
          'role',
          'type',
          'class',
        ];
        const attributes: Record<string, string> = {};
        attributeNames.forEach((attr) => {
          const value = el.getAttribute(attr);
          if (value) attributes[attr] = value;
        });

        let parentContext = '';
        let parent = el.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
          if (parent.id) {
            parentContext = `#${parent.id}`;
            break;
          }
          if (parent.className && typeof parent.className === 'string') {
            const cls = parent.className.split(' ')[0];
            if (cls) parentContext = `.${cls}`;
            break;
          }
          parent = parent.parentElement;
        }

        results.push({
          tag: el.tagName.toLowerCase(),
          text: (el as HTMLElement).innerText?.trim().slice(0, 80) || '',
          value: (el as HTMLInputElement).value || '',
          attributes,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          parentContext,
          index: results.length,
        });
      });

      return results;
    } catch (e) {
      console.warn('[buildUIGraph] DOM extraction error:', e);
      return [];
    }
  }, fullConfig);

  const elements = domElements.map((dom) => buildUIElement(dom, fullConfig));
  return categorizeElements('', elements);
}

function buildUIElement(dom: DOMElement, config: ObserverConfig): UIElement {
  const { selector, priority } = buildSelector(dom);

  return {
    id: generateElementId(dom),
    role: inferRole(dom),
    label: dom.text || dom.value || dom.attributes['aria-label'] || dom.tag,
    selector,
    selectorPriority: priority,
    boundingBox: dom.rect,
    visibility: ElementVisibility.VISIBLE,
    disabled: dom.attributes['disabled'] !== undefined,
    parentContext: dom.parentContext,
    attributes: dom.attributes,
  };
}

/**
 * 构建选择器 - 修复版
 * 优先级: data-testid > id > aria-label > name > role+text > css-path
 */
function buildSelector(dom: DOMElement): { selector: string; priority: number } {
  const { attributes, tag, text } = dom;

  // 1. data-testid (最稳定)
  if (attributes['data-testid']) {
    return {
      selector: `[data-testid="${attributes['data-testid']}"]`,
      priority: 1,
    };
  }

  // 2. id (直接使用，不做唯一性检查)
  if (attributes['id']) {
    return { selector: `#${attributes['id']}`, priority: 2 };
  }

  // 3. aria-label
  if (attributes['aria-label']) {
    const role = attributes['role'] || tag;
    return {
      selector: `[role="${role}"][aria-label="${attributes['aria-label']}"]`,
      priority: 3,
    };
  }

  // 4. name属性
  if (attributes['name']) {
    const type = attributes['type'] || '';
    return {
      selector: `${tag}[name="${attributes['name']}"]${type ? `[type="${type}"]` : ''}`,
      priority: 4,
    };
  }

  // 5. role + text
  if (attributes['role'] && text) {
    return {
      selector: `[role="${attributes['role']}"]`,
      priority: 5,
    };
  }

  // 6. CSS path (稳定的)
  return { selector: generateStableCSSPath(dom), priority: 6 };
}

/**
 * 生成稳定的CSS路径 - 改进版
 */
function generateStableCSSPath(dom: DOMElement): string {
  const parts: string[] = [dom.tag];
  const { attributes } = dom;

  // 优先使用class
  if (attributes['class'] && typeof attributes['class'] === 'string') {
    const classes = attributes['class'].split(' ').filter((c) => c.length > 2);
    if (classes.length > 0) {
      parts.push(`.${classes[0]}`);
      return parts.join('');
    }
  }

  // 没有class使用id
  if (attributes['id']) {
    return `${dom.tag}#${attributes['id']}`;
  }

  // 最后使用type
  if (attributes['type']) {
    return `${dom.tag}[type="${attributes['type']}"]`;
  }

  return dom.tag;
}

function generateElementId(dom: DOMElement): string {
  const { attributes, tag, text, index } = dom;

  if (attributes['data-testid']) return attributes['data-testid'];
  if (attributes['id']) return attributes['id'];

  const label = text || dom.value || '';
  const cleanLabel = label
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
    .slice(0, 20)
    .toLowerCase();

  if (cleanLabel) {
    return `${tag}_${cleanLabel}`;
  }

  return `${tag}_${index}`;
}

function inferRole(dom: DOMElement): ElementRole {
  const { tag, attributes } = dom;
  const role = attributes['role'];

  if (role) {
    switch (role.toLowerCase()) {
      case 'button':
        return ElementRole.BUTTON;
      case 'link':
        return ElementRole.LINK;
      case 'checkbox':
        return ElementRole.CHECKBOX;
      case 'radio':
        return ElementRole.RADIO;
    }
  }

  switch (tag) {
    case 'button':
      return ElementRole.BUTTON;
    case 'a':
      return ElementRole.LINK;
    case 'input':
      switch (attributes['type']) {
        case 'checkbox':
          return ElementRole.CHECKBOX;
        case 'radio':
          return ElementRole.RADIO;
        default:
          return ElementRole.INPUT;
      }
    case 'select':
      return ElementRole.SELECT;
    case 'textarea':
      return ElementRole.TEXTAREA;
    default:
      return ElementRole.UNKNOWN;
  }
}

function categorizeElements(url: string, elements: UIElement[]): UIGraph {
  const navigation: UIElement[] = [];
  const inputs: UIElement[] = [];
  const actions: UIElement[] = [];
  const content: UIElement[] = [];

  const navKeywords = ['nav', 'menu', 'header', 'sidebar', 'tab'];

  for (const el of elements) {
    switch (el.role) {
      case ElementRole.LINK:
        if (navKeywords.some((k) => el.parentContext.toLowerCase().includes(k))) {
          navigation.push(el);
        } else {
          content.push(el);
        }
        break;
      case ElementRole.INPUT:
      case ElementRole.TEXTAREA:
      case ElementRole.SELECT:
        inputs.push(el);
        break;
      case ElementRole.BUTTON:
      case ElementRole.CHECKBOX:
      case ElementRole.RADIO:
        actions.push(el);
        break;
      default:
        if (el.label) actions.push(el);
    }
  }

  return {
    url,
    title: '',
    timestamp: Date.now(),
    elements,
    navigation,
    inputs,
    actions,
    content,
  };
}

export { buildSelector };
