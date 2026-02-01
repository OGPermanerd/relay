"use client";

import { useQueryState, parseAsString } from "nuqs";
import { useTransition } from "react";

export function useAuthorFilter() {
  const [author, setAuthor] = useQueryState("author", parseAsString);
  const [isPending, startTransition] = useTransition();

  const filterByAuthor = (authorId: string) => {
    startTransition(() => {
      // Toggle: if already filtering by this author, clear it
      setAuthor(author === authorId ? null : authorId);
    });
  };

  const clearAuthor = () => {
    startTransition(() => {
      setAuthor(null);
    });
  };

  return { author, filterByAuthor, clearAuthor, isPending };
}
