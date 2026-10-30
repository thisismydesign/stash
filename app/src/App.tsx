import { useEffect, useState } from "react";
import { BoardPage } from "./Board.tsx";
import { BoardsPage } from "./Boards.tsx";

export type Route = { page: "boards" } | { page: "board"; id: string };

const read = (): Route => {
  const [first, id] = window.location.hash.replace(/^#\/?/, "").split("/");
  return first === "b" && id ? { page: "board", id } : { page: "boards" };
};

export const go = {
  home: () => (window.location.hash = "/"),
  board: (id: string) => (window.location.hash = `/b/${id}`),
};

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function Stash({ route }: { route: Route }) {
  if (route.page === "board") return <BoardPage id={route.id} onBack={go.home} />;
  return <BoardsPage onOpen={go.board} />;
}
