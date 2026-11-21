import { useEffect, useState } from 'react';

export type Route =
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'backup' }
  | { name: 'detail'; id: string }
  | { name: 'edit'; id: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/new') return { name: 'new' };
  if (path === '/backup') return { name: 'backup' };
  let m = path.match(/^\/recipe\/([^/]+)\/edit$/);
  if (m) return { name: 'edit', id: decodeURIComponent(m[1]) };
  m = path.match(/^\/recipe\/([^/]+)$/);
  if (m) return { name: 'detail', id: decodeURIComponent(m[1]) };
  return { name: 'list' };
}

export const paths = {
  list: '#/',
  new: '#/new',
  backup: '#/backup',
  detail: (id: string) => `#/recipe/${encodeURIComponent(id)}`,
  edit: (id: string) => `#/recipe/${encodeURIComponent(id)}/edit`,
};

export function go(path: string, { replace = false } = {}) {
  if (replace) {
    history.replaceState(null, '', path);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = path;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
