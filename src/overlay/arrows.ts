import type { Square } from '../types';
import { shortenLine, squareToCenter } from './coordinates';

export type ArrowType = 'best' | 'mistake';
export interface RookHint { from: Square; to: Square; }
export interface DrawHintOptions {
  svg: SVGSVGElement;
  from: Square;
  to: Square;
  isFlipped: boolean;
  label: string;
  capture?: boolean;
  rook?: RookHint;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function element<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

export function createArrowDefs(svg: SVGSVGElement): void {
  if (svg.querySelector('#chess-practice-overlay-defs')) return;
  const defs = element('defs');
  defs.id = 'chess-practice-overlay-defs';
  const gradient = element('linearGradient');
  gradient.id = 'chess-hint-gradient';
  gradient.setAttribute('x1', '0%');
  gradient.setAttribute('y1', '0%');
  gradient.setAttribute('x2', '100%');
  gradient.setAttribute('y2', '100%');
  for (const [offset, color] of [['0%', '#86efac'], ['100%', '#16a34a']]) {
    const stop = element('stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    gradient.appendChild(stop);
  }
  const marker = element('marker');
  marker.id = 'chess-hint-arrowhead';
  marker.setAttribute('markerWidth', '0.72');
  marker.setAttribute('markerHeight', '0.72');
  marker.setAttribute('refX', '0.62');
  marker.setAttribute('refY', '0.36');
  marker.setAttribute('orient', 'auto');
  marker.setAttribute('markerUnits', 'userSpaceOnUse');
  const head = element('path');
  head.setAttribute('d', 'M 0 0 L 0.72 0.36 L 0 0.72 Z');
  head.setAttribute('fill', '#16a34a');
  head.setAttribute('opacity', '0.82');
  marker.appendChild(head);
  defs.append(gradient, marker);
  svg.appendChild(defs);
}

function squareMarker(square: Square, isFlipped: boolean, target: boolean, capture: boolean): SVGRectElement {
  const point = squareToCenter(square, isFlipped);
  const rect = element('rect');
  rect.setAttribute('x', String(point.x - 0.43));
  rect.setAttribute('y', String(point.y - 0.43));
  rect.setAttribute('width', '0.86');
  rect.setAttribute('height', '0.86');
  rect.setAttribute('rx', '0.13');
  rect.setAttribute('fill', target ? '#22c55e' : '#86efac');
  rect.setAttribute('fill-opacity', target ? (capture ? '0.30' : '0.20') : '0.12');
  rect.setAttribute('stroke', target ? '#4ade80' : '#86efac');
  rect.setAttribute('stroke-width', target ? (capture ? '0.075' : '0.055') : '0.04');
  rect.setAttribute('stroke-opacity', target ? '0.92' : '0.72');
  return rect;
}

function line(from: Square, to: Square, isFlipped: boolean, secondary = false): SVGLineElement {
  const start = squareToCenter(from, isFlipped);
  const end = shortenLine(start, squareToCenter(to, isFlipped), secondary ? 0.18 : 0.27);
  const result = element('line');
  result.setAttribute('x1', String(start.x));
  result.setAttribute('y1', String(start.y));
  result.setAttribute('x2', String(end.x));
  result.setAttribute('y2', String(end.y));
  result.setAttribute('stroke-linecap', 'round');
  if (secondary) {
    result.setAttribute('stroke', '#bbf7d0');
    result.setAttribute('stroke-width', '0.075');
    result.setAttribute('stroke-dasharray', '0.12 0.10');
    result.setAttribute('opacity', '0.72');
  } else {
    result.setAttribute('stroke', 'url(#chess-hint-gradient)');
    result.setAttribute('stroke-width', '0.135');
    result.setAttribute('marker-end', 'url(#chess-hint-arrowhead)');
    result.setAttribute('opacity', '0.82');
  }
  return result;
}

function badge(label: string, target: Square, isFlipped: boolean): SVGGElement {
  const point = squareToCenter(target, isFlipped);
  const width = Math.min(2.5, Math.max(0.9, 0.15 * label.length + 0.34));
  const x = Math.max(0.08, Math.min(7.92 - width, point.x - width / 2));
  const y = point.y < 1.05 ? point.y + 0.48 : point.y - 0.78;
  const group = element('g');
  const background = element('rect');
  background.setAttribute('x', String(x));
  background.setAttribute('y', String(y));
  background.setAttribute('width', String(width));
  background.setAttribute('height', '0.38');
  background.setAttribute('rx', '0.12');
  background.setAttribute('fill', '#102117');
  background.setAttribute('fill-opacity', '0.94');
  background.setAttribute('stroke', '#4ade80');
  background.setAttribute('stroke-width', '0.025');
  const text = element('text');
  text.setAttribute('x', String(x + width / 2));
  text.setAttribute('y', String(y + 0.255));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('fill', '#f0fdf4');
  text.setAttribute('font-size', '0.205');
  text.setAttribute('font-weight', '650');
  text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif');
  text.textContent = label;
  group.append(background, text);
  return group;
}

export function drawHint(options: DrawHintOptions): SVGGElement {
  const group = element('g');
  group.classList.add('chess-practice-hint');
  group.append(squareMarker(options.from, options.isFlipped, false, false));
  group.append(squareMarker(options.to, options.isFlipped, true, options.capture ?? false));
  if (options.rook) {
    group.append(squareMarker(options.rook.from, options.isFlipped, false, false));
    group.append(line(options.rook.from, options.rook.to, options.isFlipped, true));
  }
  group.append(line(options.from, options.to, options.isFlipped));
  group.append(badge(options.label, options.to, options.isFlipped));
  options.svg.appendChild(group);
  return group;
}
