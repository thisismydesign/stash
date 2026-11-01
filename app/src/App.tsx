import { useEffect, useState } from "react";
import { BoardPage } from "./Board.tsx";
import { BoardsPage } from "./Boards.tsx";
import { SharedBoardPage } from "./SharedBoard.tsx";

export type Route =
  { page: "boards" } | { page: "board"; id: string } | { page: "shared"; token: string };

const read = (): Route => {
  const [first, id] = window.location.pathname.replace(/^\//, "").split("/");
  if (first === "b" && id) return { page: "board", id };
  if (first === "s" && id) return { page: "shared", token: id };
  return { page: "boards" };
};

/** Addresses were fragments once; a link kept from then still opens. Call before the first render. */
export const adoptFragmentAddress = () => {
  const path = window.location.hash.replace(/^#\/?/, "/");
  if (/^\/[bs]\/./.test(path)) window.history.replaceState(null, "", path);
};

const navigate = (path: string) => {
  if (window.location.pathname === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const go = {
  home: () => navigate("/"),
  board: (id: string) => navigate(`/b/${id}`),
};

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return route;
}

export function Stash({ route }: { route: Route }) {
  if (route.page === "board") return <BoardPage id={route.id} onBack={go.home} />;
  if (route.page === "shared") return <SharedBoardPage token={route.token} onBack={go.home} />;
  return <BoardsPage onOpen={go.board} />;
}
