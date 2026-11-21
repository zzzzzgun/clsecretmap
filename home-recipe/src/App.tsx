import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { paths, useRoute } from './router';
import { useStore } from './store';
import { DetailView } from './views/DetailView';
import { EditView } from './views/EditView';
import { ListView, type ListState } from './views/ListView';

export function App() {
  const route = useRoute();
  const { recipes, storageWarning } = useStore();
  // 詳細から戻ったときに検索条件とスクロール位置を残しておく
  const [listState, setListState] = useState<ListState>({ query: '', field: 'all', sort: 'updated' });
  const listScroll = useRef(0);
  const prevRoute = useRef(route.name);

  useLayoutEffect(() => {
    if (prevRoute.current === 'list' && route.name !== 'list') listScroll.current = window.scrollY;
    if (route.name === 'list') window.scrollTo(0, prevRoute.current === 'list' ? window.scrollY : listScroll.current);
    else window.scrollTo(0, 0);
    prevRoute.current = route.name;
  }, [route]);

  useEffect(() => {
    const name = route.name === 'detail' || route.name === 'edit' ? recipes.find((r) => r.id === route.id)?.name : undefined;
    document.title = name ? `${name} – わが家のレシピ` : 'わが家のレシピ';
  }, [route, recipes]);

  let view;
  if (route.name === 'list') view = <ListView state={listState} onChange={setListState} />;
  else if (route.name === 'new') view = <EditView key="new" />;
  else {
    const recipe = recipes.find((r) => r.id === route.id);
    if (!recipe) view = <NotFound />;
    else if (route.name === 'edit') view = <EditView key={recipe.id} recipe={recipe} />;
    else view = <DetailView key={recipe.id} recipe={recipe} />;
  }

  return (
    <>
      {storageWarning && (
        <div className="notice warn" role="alert">
          {storageWarning}
        </div>
      )}
      {view}
    </>
  );
}

function NotFound() {
  return (
    <main>
      <div className="empty card">
        <p>このレシピは見つかりません。削除された可能性があります。</p>
        <a className="button" href={paths.list}>
          一覧へ戻る
        </a>
      </div>
    </main>
  );
}
