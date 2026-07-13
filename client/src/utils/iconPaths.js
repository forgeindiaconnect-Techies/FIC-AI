import { fabric } from 'fabric';

export const ICON_PATHS = {
  briefcase: "M 20 7 L 4 7 C 2.9 7 2 7.9 2 9 L 2 19 C 2 20.1 2.9 21 4 21 L 20 21 C 21.1 21 22 20.1 22 19 L 22 9 C 22 7.9 21.1 7 20 7 Z M 16 7 L 16 5 C 16 3.9 15.1 3 14 3 L 10 3 C 8.9 3 8 3.9 8 5 L 8 7 M 12 12 L 12 15",
  graduationcap: "M 22 10 L 12 5 L 2 10 L 12 15 Z M 6 12 L 6 17 C 6 18.1 8.7 19 12 19 C 15.3 19 18 18.1 18 17 L 18 12 M 20 12 L 20 17.5",
  calendar: "M 19 4 L 5 4 C 3.9 4 3 4.9 3 6 L 3 20 C 3 21.1 3.9 22 5 22 L 19 22 C 20.1 22 21 21.1 21 20 L 21 6 C 21 4.9 20.1 4 19 4 Z M 16 2 L 16 6 M 8 2 L 8 6 M 3 10 L 21 10",
  mappin: "M 21 10 C 21 17 12 23 12 23 C 12 23 3 17 3 10 C 3 5 7 1 12 1 C 17 1 21 5 21 10 Z M 12 13 C 13.7 13 15 11.7 15 10 C 15 8.3 13.7 7 12 7 C 10.3 7 9 8.3 9 10 C 9 11.7 10.3 13 12 13 Z",
  code: "M 17 8 L 22 12 L 17 16 M 7 8 L 2 12 L 7 16 M 14 4 L 10 20",
  dollarsign: "M 12 1 L 12 23 M 17 5 L 9.5 5 C 7.6 5 6 6.6 6 8.5 C 6 10.4 7.6 12 9.5 12 L 14.5 12 C 16.4 12 18 13.6 18 15.5 C 18 17.4 16.4 19 14.5 19 L 7 19",
  mail: "M 4 4 L 20 4 C 21.1 4 22 4.9 22 6 L 22 18 C 22 19.1 21.1 20 20 20 L 4 20 C 2.9 20 2 19.1 2 18 L 2 6 C 2 4.9 2.9 4 4 4 Z M 22 6 L 12 13 L 2 6",
  phone: "M 22 16.9 L 22 20.4 C 22 21.6 21 22.4 19.8 22.4 C 9.6 22.4 1.6 14.4 1.6 4.2 C 1.6 3 2.4 2 3.6 2 L 7.1 2 C 8 2 8.7 2.7 8.9 3.5 L 9.6 7.4 C 9.7 8.2 9.4 9 8.7 9.5 L 6.6 11.2 C 7.8 13.2 9.6 15 11.6 16.2 L 13.3 14.1 C 13.8 13.4 14.6 13.1 15.4 13.2 L 19.3 13.9 C 20.1 14.1 20.8 14.8 20.8 15.7 Z",
  globe: "M 12 2 C 17.5 2 22 6.5 22 12 C 22 17.5 17.5 22 12 22 C 6.5 22 2 17.5 2 12 C 2 6.5 6.5 2 12 2 Z M 2 12 L 22 12 M 12 2 C 14.5 4.8 16 8.3 16 12 C 16 15.7 14.5 19.2 12 22 C 9.5 19.2 8 15.7 8 12 C 8 8.3 9.5 4.8 12 2 Z",
  award: "M 12 15 C 15.9 15 19 11.9 19 8 C 19 4.1 15.9 1 12 1 C 8.1 1 5 4.1 5 8 C 5 11.9 8.1 15 12 15 Z M 8.2 14.3 L 6 23 L 12 20 L 18 23 L 15.8 14.3 M 12 5 L 13.5 8 L 17 8.5 L 14.5 11 L 15 14.5 L 12 13 L 9 14.5 L 9.5 11 L 7 8.5 L 10.5 8 Z",
  sparkles: "M 12 3 L 14.5 8.5 L 20 11 L 14.5 13.5 L 12 19 L 9.5 13.5 L 4 11 L 9.5 8.5 Z M 5 3 L 6 5.5 L 8.5 6.5 L 6 7.5 L 5 10 L 4 7.5 L 1.5 6.5 L 4 5.5 Z M 19 15 L 19.5 16.5 L 21 17 L 19.5 17.5 L 19 19 L 18.5 17.5 L 17 17 L 18.5 16.5 Z",
  checkcircle: "M 22 11.08 A 10 10 0 1 1 18 4.62 M 22 4 L 12 14.01 L 9 11.01",
  star: "M 12 2 L 15.09 8.26 L 22 9.27 L 17 14.14 L 18.18 21.02 L 12 17.77 L 5.82 21.02 L 7 14.14 L 2 9.27 L 8.91 8.26 Z",
  user: "M 20 21 C 20 18.2 16.4 16 12 16 C 7.6 16 4 18.2 4 21 M 12 12 C 14.2 12 16 10.2 16 8 C 16 5.8 14.2 4 12 4 C 9.8 4 8 5.8 8 8 C 8 10.2 9.8 12 12 12 Z",
  info: "M 12 2 C 6.5 2 2 6.5 2 12 C 2 17.5 6.5 22 12 22 C 17.5 22 22 17.5 22 12 C 22 6.5 17.5 2 12 2 Z M 12 16 L 12 12 M 12 8 L 12.01 8",
  trendingup: "M 23 6 L 13.5 15.5 L 8.5 10.5 L 1 18 M 17 6 L 23 6 L 23 12",
  check: "M 20 6 L 9 17 L 4 12"
};

export function createFabricIcon(iconName, options = {}) {
  const name = iconName.toLowerCase().replace(/[^a-z]/g, '');
  const pathData = ICON_PATHS[name] || ICON_PATHS.info;

  const defaultOpts = {
    fill: options.fill || '#FFFFFF',
    stroke: options.stroke || null,
    strokeWidth: options.strokeWidth || 0,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    scaleX: (options.size || 24) / 24,
    scaleY: (options.size || 24) / 24,
    selectable: options.selectable !== undefined ? options.selectable : true,
    originX: 'center',
    originY: 'center',
    left: options.left || 0,
    top: options.top || 0,
    name: options.name || `Icon-${iconName}`
  };

  // Check if stroke should be set (for stroke-only outline icons)
  if (name === 'checkcircle' || name === 'code' || name === 'calendar' || name === 'mappin' || name === 'phone' || name === 'mail' || name === 'globe' || name === 'trendingup' || name === 'check') {
    defaultOpts.stroke = options.fill || '#FFFFFF';
    defaultOpts.strokeWidth = options.strokeWidth || 2;
    defaultOpts.fill = 'transparent';
  }

  return new fabric.Path(pathData, defaultOpts);
}
